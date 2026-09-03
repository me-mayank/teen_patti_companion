const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    res.status(400);
    // Extract Zod error messages
    const message = error.errors.map((e) => e.message).join(', ');
    next(new Error(message));
  }
};

module.exports = { validate };
