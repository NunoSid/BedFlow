-- Add idade e sexo ao registo de admissões
ALTER TABLE "Admission"
ADD COLUMN "ageYears" INTEGER;

ALTER TABLE "Admission"
ADD COLUMN "sex" TEXT;
