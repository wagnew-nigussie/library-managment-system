import { Router } from "express";
import prisma from "../config/prisma.js";
import institutionUsersRouter from "./institutionUsers.js";
import {
  requireAuth,
  requireSuperAdmin,
  requireInstitutionRole,
  requireCatalogStaff,
  requireLoanInstitutionRole
} from "../middleware/auth.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Library Management API is running"
  });
});

// Create an institution. It stays PENDING until approved.
router.post("/institutions", async (req, res, next) => {
  try {
    const { name, slug, email, phone, address } = req.body;

    if (!name?.trim() || !slug?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Institution name and slug are required"
      });
    }

    const institution = await prisma.institution.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        email,
        phone,
        address,
        settings: { create: {} }
      }
    });

    res.status(201).json({ success: true, data: institution });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "That institution slug is already in use"
      });
    }
    next(error);
  }
});

// All routes below this point require a valid login.
router.use(requireAuth);

router.use("/institutions", institutionUsersRouter);

router.get("/institutions", async (req, res, next) => {
  try {
    const allowedIds = req.user.isSuperAdmin
      ? null
      : req.user.memberships
          .filter((membership) => membership.institution.status === "APPROVED")
          .map((membership) => membership.institution.id);

    const institutions = await prisma.institution.findMany({
      where: req.user.isSuperAdmin
        ? {}
        : { id: { in: allowedIds } },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, data: institutions });
  } catch (error) {
    next(error);
  }
});


// Approve a pending institution.
// Development only: protect this endpoint with Super Admin authentication
// before deploying the system.
router.patch("/institutions/:id/approve", requireSuperAdmin, async (req, res, next) => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: req.params.id }
    });

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found"
      });
    }

    if (institution.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: "Only pending institutions can be approved"
      });
    }

    const updated = await prisma.institution.update({
      where: { id: institution.id },
      data: { status: "APPROVED" }
    });

    res.json({
      success: true,
      message: "Institution approved",
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

// Reject a pending institution.
// Development only: protect this endpoint with Super Admin authentication
// before deploying the system.
router.patch("/institutions/:id/reject", requireSuperAdmin, async (req, res, next) => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: req.params.id }
    });

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found"
      });
    }

    if (institution.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: "Only pending institutions can be rejected"
      });
    }

    const updated = await prisma.institution.update({
      where: { id: institution.id },
      data: { status: "REJECTED" }
    });

    res.json({
      success: true,
      message: "Institution rejected",
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

// Add shared book metadata to the catalog.

router.post("/books", requireCatalogStaff, async (req, res, next) => {
  try {
    const {
      title, author, isbn, publisher, edition, description, confirmDuplicate
    } = req.body;

    if (!title?.trim() || !author?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Book title and author are required"
      });
    }

    const clean = (value) => String(value ?? "").trim();

    const normalize = (value) => clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const similarity = (left, right) => {
      const a = normalize(left);
      const b = normalize(right);
      if (!a || !b) return 0;
      if (a === b) return 1;

      let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

      for (let i = 1; i <= a.length; i++) {
        const current = [i];

        for (let j = 1; j <= b.length; j++) {
          current[j] = Math.min(
            current[j - 1] + 1,
            previous[j] + 1,
            previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
          );
        }

        previous = current;
      }

      return 1 - previous[b.length] / Math.max(a.length, b.length);
    };

    if (confirmDuplicate !== true) {
      const probes = [];
      const isbnValue = clean(isbn);
      const titleWord = clean(title).split(/\s+/)[0];
      const authorWord = clean(author).split(/\s+/)[0];

      if (isbnValue) {
        probes.push({
          isbn: { contains: isbnValue, mode: "insensitive" }
        });
      }

      if (titleWord) {
        probes.push({
          title: { contains: titleWord, mode: "insensitive" }
        });
      }

      if (authorWord) {
        probes.push({
          author: { contains: authorWord, mode: "insensitive" }
        });
      }

      const existingBooks = await prisma.book.findMany({
        where: { OR: probes },
        select: {
          id: true,
          title: true,
          author: true,
          isbn: true,
          publisher: true,
          edition: true
        },
        orderBy: { updatedAt: "desc" },
        take: 200
      });

      const candidates = existingBooks.map((book) => {
        const isbnMatch = Boolean(normalize(isbn)) &&
          normalize(isbn) === normalize(book.isbn);

        const titleSimilarity = similarity(title, book.title);
        const authorSimilarity = similarity(author, book.author);
        const titleMatch = titleSimilarity >= 0.82;
        const authorMatch = authorSimilarity >= 0.85;

        const publisherMatch = Boolean(normalize(publisher)) &&
          normalize(publisher) === normalize(book.publisher);

        const editionMatch = Boolean(normalize(edition)) &&
          normalize(edition) === normalize(book.edition);

        const matchedFields = [];
        let score = 0;

        if (isbnMatch) {
          matchedFields.push("ISBN");
          score += 100;
        }

        if (titleMatch) {
          matchedFields.push(
            titleSimilarity === 1 ? "Title" : "Similar title"
          );
          score += titleSimilarity === 1 ? 45 : 30;
        }

        if (authorMatch) {
          matchedFields.push(
            authorSimilarity === 1 ? "Author" : "Similar author"
          );
          score += authorSimilarity === 1 ? 35 : 20;
        }

        if (publisherMatch) {
          matchedFields.push("Publisher");
          score += 15;
        }

        if (editionMatch) {
          matchedFields.push("Edition");
          score += 10;
        }

        const possibleDuplicate =
          isbnMatch ||
          (titleMatch && authorMatch) ||
          (titleSimilarity === 1 && publisherMatch && editionMatch);

        return {
          ...book,
          matchedFields,
          score,
          possibleDuplicate
        };
      })
      .filter((book) => book.possibleDuplicate)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ possibleDuplicate, ...book }) => book);

      if (candidates.length > 0) {
        return res.status(409).json({
          success: false,
          code: "DUPLICATE_CANDIDATES",
          message: "Possible duplicate books found. Review them before continuing.",
          candidates
        });
      }
    }

    const book = await prisma.book.create({
      data: {
        title: clean(title),
        author: clean(author),
        isbn: clean(isbn) || null,
        publisher: clean(publisher) || null,
        edition: clean(edition) || null,
        description: clean(description) || null
      }
    });

    res.status(201).json({ success: true, data: book });
  } catch (error) {
    next(error);
  }
});

router.get("/books", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();

    const allowedCopyInstitutionIds = req.user.isSuperAdmin
      ? null
      : req.user.memberships
          .filter((membership) => membership.institution.status === "APPROVED")
          .map((membership) => membership.institution.id);

    const books = await prisma.book.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { author: { contains: search, mode: "insensitive" } },
              { isbn: { contains: search, mode: "insensitive" } }
            ]
          }
        : undefined,
      include: {
        copiesAsBook: {
          where: req.user.isSuperAdmin
            ? undefined
            : { institutionId: { in: allowedCopyInstitutionIds } },
          select: {
            id: true,
            institutionId: true,
            status: true,
            barcode: true,
            shelfLocation: true
          }
        }
      },
      orderBy: { title: "asc" },
      take: 100
    });

    res.json({ success: true, data: books });
  } catch (error) {
    next(error);
  }
});

// Add an institution-owned physical copy of a catalog book.
router.post("/copies", requireInstitutionRole("INSTITUTION_ADMIN", "LIBRARIAN"), async (req, res, next) => {
  try {
    const { institutionId, bookId, barcode, shelfLocation } = req.body;

    if (!institutionId || !bookId || !barcode?.trim()) {
      return res.status(400).json({
        success: false,
        message: "institutionId, bookId and barcode are required"
      });
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId }
    });

    if (!institution || institution.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Institution must exist and be approved"
      });
    }

    const copy = await prisma.bookCopy.create({
      data: {
        institutionId,
        bookId,
        barcode: barcode.trim(),
        shelfLocation: shelfLocation?.trim() || null
      }
    });

    res.status(201).json({ success: true, data: copy });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "That barcode is already used by this institution"
      });
    }
    next(error);
  }
});

// Add a library member.
router.post("/members", requireInstitutionRole("INSTITUTION_ADMIN", "LIBRARIAN"), async (req, res, next) => {
  try {
    const { institutionId, membershipNumber, fullName, email, phone } = req.body;

    if (!institutionId || !membershipNumber?.trim() || !fullName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "institutionId, membershipNumber and fullName are required"
      });
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId }
    });

    if (!institution || institution.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Institution must exist and be approved"
      });
    }

    const member = await prisma.member.create({
      data: {
        institutionId,
        membershipNumber: membershipNumber.trim(),
        fullName: fullName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null
      }
    });

    res.status(201).json({ success: true, data: member });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "That membership number is already used by this institution"
      });
    }
    next(error);
  }
});

router.get("/members", requireInstitutionRole("INSTITUTION_ADMIN", "LIBRARIAN"), async (req, res, next) => {
  try {
    const { institutionId } = req.query;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "institutionId query parameter is required"
      });
    }

    const members = await prisma.member.findMany({
      where: { institutionId: String(institutionId) },
      orderBy: { fullName: "asc" }
    });

    res.json({ success: true, data: members });
  } catch (error) {
    next(error);
  }
});


// Borrow an available book copy.
router.post("/loans", requireInstitutionRole("INSTITUTION_ADMIN", "LIBRARIAN"), async (req, res, next) => {
  try {
    const { institutionId, memberId, bookCopyId, dueAt } = req.body;

    if (!institutionId || !memberId || !bookCopyId) {
      return res.status(400).json({
        success: false,
        message: "institutionId, memberId and bookCopyId are required"
      });
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      include: { settings: true }
    });

    if (!institution || institution.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Institution must exist and be approved"
      });
    }

    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        institutionId,
        status: "ACTIVE"
      }
    });

    if (!member) {
      return res.status(400).json({
        success: false,
        message: "Active member not found in this institution"
      });
    }

    const copy = await prisma.bookCopy.findFirst({
      where: { id: bookCopyId, institutionId }
    });

    if (!copy) {
      return res.status(404).json({
        success: false,
        message: "Book copy not found in this institution"
      });
    }

    if (copy.status !== "AVAILABLE") {
      return res.status(409).json({
        success: false,
        message: "Book copy is not available"
      });
    }

    const maxLoans = institution.settings?.maxLoans ?? 5;
    const activeLoans = await prisma.loan.count({
      where: {
        institutionId,
        memberId,
        status: { in: ["ACTIVE", "OVERDUE"] }
      }
    });

    if (activeLoans >= maxLoans) {
      return res.status(409).json({
        success: false,
        message: "Member has reached the maximum number of loans"
      });
    }

    const loanDays = institution.settings?.loanDays ?? 14;
    const dueDate = dueAt
      ? new Date(dueAt)
      : new Date(Date.now() + loanDays * 24 * 60 * 60 * 1000);

    if (Number.isNaN(dueDate.getTime()) || dueDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "dueAt must be a valid future date"
      });
    }

    const loan = await prisma.$transaction(async (tx) => {
      const updatedCopy = await tx.bookCopy.updateMany({
        where: {
          id: bookCopyId,
          institutionId,
          status: "AVAILABLE"
        },
        data: { status: "LOANED" }
      });

      if (updatedCopy.count !== 1) {
        const error = new Error("Book copy is no longer available");
        error.status = 409;
        throw error;
      }

      return tx.loan.create({
        data: {
          institutionId,
          memberId,
          bookCopyId,
          dueAt: dueDate
        },
        include: {
          member: true,
          bookCopy: { include: { book: true } }
        }
      });
    });

    res.status(201).json({ success: true, data: loan });
  } catch (error) {
    next(error);
  }
});


// Return a borrowed book.
router.patch("/loans/:id/return", requireLoanInstitutionRole("INSTITUTION_ADMIN", "LIBRARIAN"), async (req, res, next) => {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: req.params.id }
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: "Loan not found"
      });
    }

    if (!["ACTIVE", "OVERDUE"].includes(loan.status)) {
      return res.status(409).json({
        success: false,
        message: "This loan cannot be returned"
      });
    }

    const returnedAt = new Date();

    const settings = await prisma.institutionSettings.findUnique({
      where: { institutionId: loan.institutionId },
      select: { finePerDay: true }
    });

    const overdueMilliseconds =
      returnedAt.getTime() - new Date(loan.dueAt).getTime();

    const lateDays = overdueMilliseconds > 0
      ? Math.ceil(overdueMilliseconds / (24 * 60 * 60 * 1000))
      : 0;

    const fineAmount = (
      lateDays * Number(settings?.finePerDay ?? 0)
    ).toFixed(2);

    const returnedLoan = await prisma.$transaction(async (tx) => {
      await tx.bookCopy.update({
        where: { id: loan.bookCopyId },
        data: { status: "AVAILABLE" }
      });

      return tx.loan.update({
        where: { id: loan.id },
        data: {
          status: "RETURNED",
          returnedAt,
          fineAmount
        },
        include: {
          member: true,
          bookCopy: { include: { book: true } }
        }
      });
    });

    res.json({
      success: true,
      message: "Book returned successfully",
      data: returnedLoan
    });
  } catch (error) {
    next(error);
  }
});


// Read institution circulation settings.
router.get("/institutions/:id/settings", requireInstitutionRole("INSTITUTION_ADMIN", "LIBRARIAN"), async (req, res, next) => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: req.params.id }
    });

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found"
      });
    }

    const settings = await prisma.institutionSettings.upsert({
      where: { institutionId: institution.id },
      update: {},
      create: { institutionId: institution.id }
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

// Update institution circulation settings.
router.patch("/institutions/:id/settings", requireInstitutionRole("INSTITUTION_ADMIN"), async (req, res, next) => {
  try {
    const institution = await prisma.institution.findUnique({
      where: { id: req.params.id }
    });

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found"
      });
    }

    const { loanDays, maxLoans, finePerDay } = req.body;
    const data = {};

    if (
      loanDays === undefined &&
      maxLoans === undefined &&
      finePerDay === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide loanDays, maxLoans, or finePerDay"
      });
    }

    if (loanDays !== undefined) {
      const value = Number(loanDays);
      if (!Number.isInteger(value) || value < 1 || value > 90) {
        return res.status(400).json({
          success: false,
          message: "loanDays must be an integer from 1 to 90"
        });
      }
      data.loanDays = value;
    }

    if (maxLoans !== undefined) {
      const value = Number(maxLoans);
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        return res.status(400).json({
          success: false,
          message: "maxLoans must be an integer from 1 to 100"
        });
      }
      data.maxLoans = value;
    }

    if (finePerDay !== undefined) {
      const value = Number(finePerDay);
      if (!Number.isFinite(value) || value < 0 || value > 100000) {
        return res.status(400).json({
          success: false,
          message: "finePerDay must be a number from 0 to 100000"
        });
      }
      data.finePerDay = value;
    }

    const settings = await prisma.institutionSettings.upsert({
      where: { institutionId: institution.id },
      update: data,
      create: { institutionId: institution.id, ...data }
    });

    res.json({
      success: true,
      message: "Institution settings updated",
      data: settings
    });
  } catch (error) {
    next(error);
  }
});

// Show loans for a specific institution.
router.get("/loans", requireInstitutionRole("INSTITUTION_ADMIN", "LIBRARIAN"), async (req, res, next) => {
  try {
    const { institutionId } = req.query;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "institutionId query parameter is required"
      });
    }

    await prisma.loan.updateMany({
      where: {
        institutionId: String(institutionId),
        status: "ACTIVE",
        dueAt: { lt: new Date() }
      },
      data: { status: "OVERDUE" }
    });

    const loans = await prisma.loan.findMany({
      where: { institutionId: String(institutionId) },
      include: {
        member: true,
        bookCopy: { include: { book: true } }
      },
      orderBy: { borrowedAt: "desc" }
    });

    res.json({ success: true, data: loans });
  } catch (error) {
    next(error);
  }
});

export default router;
