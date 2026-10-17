import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { validateProfileImage } from "../shared/profileImage.js";

const router = Router();

const allowedRoles = [
  "INSTITUTION_ADMIN",
  "LIBRARIAN",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "MEMBER"
];

function canManageInstitution(req, institutionId) {
  if (req.user?.isSuperAdmin) return true;

  return req.user?.memberships?.some(
    (m) =>
      m.institution.id === institutionId &&
      m.institution.status === "APPROVED" &&
      m.role === "INSTITUTION_ADMIN"
  ) ?? false;
}

router.get("/:id/users", async (req, res, next) => {
  try {
    const institutionId = req.params.id;

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, status: true }
    });

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found"
      });
    }

    if (institution.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Institution must be approved first"
      });
    }

    if (!canManageInstitution(req, institutionId)) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage users for this institution"
      });
    }

    const users = await prisma.institutionUser.findMany({
      where: { institutionId },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            profileImage: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/users/:userId/profile-image", async (req, res, next) => {
  try {
    const institutionId = req.params.id;
    const userId = req.params.userId;
    const body = req.body || {};

    if (!Object.prototype.hasOwnProperty.call(body, "profileImage")) {
      return res.status(400).json({ success: false, message: "Profile image is required. Use null to remove it." });
    }

    const photo = validateProfileImage(body.profileImage);
    if (!photo.ok) {
      return res.status(400).json({ success: false, message: photo.message });
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, status: true }
    });
    if (!institution) {
      return res.status(404).json({ success: false, message: "Institution not found" });
    }
    if (institution.status !== "APPROVED") {
      return res.status(400).json({ success: false, message: "Institution must be approved first" });
    }
    if (!canManageInstitution(req, institutionId)) {
      return res.status(403).json({ success: false, message: "You cannot manage users for this institution" });
    }

    const membership = await prisma.institutionUser.findUnique({
      where: { institutionId_userId: { institutionId, userId } },
      select: { id: true }
    });
    if (!membership) {
      return res.status(404).json({ success: false, message: "User is not assigned to this institution" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: photo.value },
      select: { id: true, fullName: true, email: true, status: true, profileImage: true }
    });

    res.json({ success: true, message: photo.value ? "Profile photo updated." : "Profile photo removed.", data: user });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/users", async (req, res, next) => {
  try {
    const institutionId = req.params.id;
    const { fullName, email, password, role, profileImage } = req.body || {};

    const photo = validateProfileImage(profileImage);
    if (!photo.ok) {
      return res.status(400).json({ success: false, message: photo.message });
    }

    if (
      typeof fullName !== "string" || !fullName.trim() ||
      typeof email !== "string" || !email.trim() ||
      typeof password !== "string" || password.length < 8 ||
      typeof role !== "string" || !allowedRoles.includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter name, valid email, password of at least 8 characters, and a valid role"
      });
    }

    if (!req.user.isSuperAdmin && role === "INSTITUTION_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can assign the Institution Admin role"
      });
    }

    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, status: true }
    });

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found"
      });
    }

    if (institution.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Approve the institution before adding users"
      });
    }

    if (!canManageInstitution(req, institutionId)) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage users for this institution"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        profileImage: photo.value,
        memberships: {
          create: { institutionId, role }
        }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        profileImage: true,
        memberships: {
          where: { institutionId },
          select: { institutionId: true, role: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: "User created and assigned to the institution",
      data: user
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "This account or membership already exists"
      });
    }

    next(error);
  }
});

export default router;
