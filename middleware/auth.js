const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ message: "Authorization header missing" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { ...decoded, id: decoded.sub }; // Ensure req.user.id is available
     console.log("auth.js req.user ",req.user)
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
