module.exports = (...roles) => {
  console.log("from where these roles are coming ",roles)
  return (req, res, next) => {
      console.log(req.user.role , roles,"these are from roles .js ")
    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: "Access denied" });
    next();
  };
};
