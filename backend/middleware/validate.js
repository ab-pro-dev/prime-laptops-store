const { body, validationResult } = require('express-validator');

const passwordComplexityRules = (field = 'password') => [
  body(field)
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters.'),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) return next();

  return res.status(400).json({
    message: 'Validation failed.',
    errors: errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    })),
  });
};

module.exports = { handleValidation, passwordComplexityRules };
