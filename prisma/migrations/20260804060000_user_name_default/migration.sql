-- El adapter de Auth.js llama createUser con { id, email, emailVerified }: un
-- magic link no aporta nombre. Sin default, ese INSERT viola el NOT NULL y
-- Auth.js lo reporta en la UI como "Configuration", que no dice nada del
-- problema real. La app muestra el email cuando el nombre está vacío.
ALTER TABLE "User" ALTER COLUMN "name" SET DEFAULT '';
