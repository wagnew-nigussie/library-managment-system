import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue"
    });
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired login token"
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        fullName: true,
        email: true,
        isSuperAdmin: true,
        status: true,
        memberships: {
          select: {
            role: true,
            institution: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    });

    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({
        success: false,
        message: "User account is unavailable"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: "Super Admin permission is required"
    });
  }

  next();
}

// Super Admin bypasses institution membership checks.
// Other users need an approved institution membership with an allowed role.
export function requireInstitutionRole(...allowedRoles) {
  return (req, res, next) => {
    if (req.user?.isSuperAdmin) {
      return next();
    }

    const institutionId =
      req.params.institutionId ||
      req.params.id ||
      req.body?.institutionId ||
      req.query?.institutionId;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: "Institution ID is required"
      });
    }

    const membership = req.user?.memberships?.find((item) =>
      item.institution.id === String(institutionId) &&
      item.institution.status === "APPROVED" &&
      allowedRoles.includes(item.role)
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission for this institution"
      });
    }

    req.institutionMembership = membership;
    next();
  };
}

// Shared catalog changes are limited to Super Admin, Institution Admin,
// or Librarian accounts attached to an approved institution.
export function requireCatalogStaff(req, res, next) {
  if (req.user?.isSuperAdmin) {
    return next();
  }

  const allowedRoles = ["INSTITUTION_ADMIN", "LIBRARIAN"];
  const hasStaffRole = req.user?.memberships?.some((item) =>
    item.institution.status === "APPROVED" &&
    allowedRoles.includes(item.role)
  );

  if (!hasStaffRole) {
    return res.status(403).json({
      success: false,
      message: "Library staff permission is required"
    });
  }

  next();
}

// A loan ID is not an institution ID, so load the loan first and verify
// that the current user has staff permission for its institution.
export function requireLoanInstitutionRole(...allowedRoles) {
  return async (req, res, next) => {
    if (req.user?.isSuperAdmin) {
      return next();
    }

    try {
      const loan = await prisma.loan.findUnique({
        where: { id: req.params.id },
        select: { id: true, institutionId: true }
      });

      if (!loan) {
        return res.status(404).json({
          success: false,
          message: "Loan not found"
        });
      }

      const membership = req.user?.memberships?.find((item) =>
        item.institution.id === loan.institutionId &&
        item.institution.status === "APPROVED" &&
        allowedRoles.includes(item.role)
      );

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission for this loan"
        });
      }

      req.institutionMembership = membership;
      next();
    } catch (error) {
      next(error);
    }
  };
}
