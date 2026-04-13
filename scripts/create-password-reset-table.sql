-- Password recovery: add columns for reset token and expiration
ALTER TABLE Usuarios
ADD password_reset_token NVARCHAR(255),
    password_reset_expires DATETIME;

-- Optional: If you want to allow password reset only for users with verified email
-- You can add a constraint or handle it in backend logic.