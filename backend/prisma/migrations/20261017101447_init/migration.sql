-- CreateEnum
CREATE TYPE "InstitutionStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'LIBRARIAN', 'TEACHER', 'STUDENT', 'PARENT', 'MEMBER');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CopyStatus" AS ENUM ('AVAILABLE', 'LOANED', 'RESERVED', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE', 'LOST');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "InstitutionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionUser" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "isbn" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "publisher" TEXT,
    "edition" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookCopy" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "status" "CopyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "shelfLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "membershipNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "bookCopyId" TEXT NOT NULL,
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionSettings" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "loanDays" INTEGER NOT NULL DEFAULT 14,
    "maxLoans" INTEGER NOT NULL DEFAULT 5,
    "finePerDay" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicateReview" (
    "id" TEXT NOT NULL,
    "candidateBookId" TEXT NOT NULL,
    "matchedBookId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "DuplicateReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "InstitutionUser_userId_idx" ON "InstitutionUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionUser_institutionId_userId_key" ON "InstitutionUser"("institutionId", "userId");

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "Book"("title");

-- CreateIndex
CREATE INDEX "Book_author_idx" ON "Book"("author");

-- CreateIndex
CREATE INDEX "Book_isbn_idx" ON "Book"("isbn");

-- CreateIndex
CREATE INDEX "BookCopy_institutionId_status_idx" ON "BookCopy"("institutionId", "status");

-- CreateIndex
CREATE INDEX "BookCopy_bookId_idx" ON "BookCopy"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCopy_institutionId_barcode_key" ON "BookCopy"("institutionId", "barcode");

-- CreateIndex
CREATE INDEX "Member_institutionId_fullName_idx" ON "Member"("institutionId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Member_institutionId_membershipNumber_key" ON "Member"("institutionId", "membershipNumber");

-- CreateIndex
CREATE INDEX "Loan_institutionId_status_idx" ON "Loan"("institutionId", "status");

-- CreateIndex
CREATE INDEX "Loan_memberId_idx" ON "Loan"("memberId");

-- CreateIndex
CREATE INDEX "Loan_bookCopyId_idx" ON "Loan"("bookCopyId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionSettings_institutionId_key" ON "InstitutionSettings"("institutionId");

-- CreateIndex
CREATE INDEX "DuplicateReview_status_idx" ON "DuplicateReview"("status");

-- AddForeignKey
ALTER TABLE "InstitutionUser" ADD CONSTRAINT "InstitutionUser_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionUser" ADD CONSTRAINT "InstitutionUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bookCopyId_fkey" FOREIGN KEY ("bookCopyId") REFERENCES "BookCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionSettings" ADD CONSTRAINT "InstitutionSettings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateReview" ADD CONSTRAINT "DuplicateReview_candidateBookId_fkey" FOREIGN KEY ("candidateBookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateReview" ADD CONSTRAINT "DuplicateReview_matchedBookId_fkey" FOREIGN KEY ("matchedBookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
