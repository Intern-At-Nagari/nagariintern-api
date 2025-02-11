require("dotenv").config();
const jwt = require("jsonwebtoken");

const { Users } = require("../models");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(403).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(403).json({ error: "Malformed token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      try {
        const expiredToken = jwt.decode(token);
        if (!expiredToken?.id) {
          return res.status(401).json({
            error: "Invalid token format",
            message: "Please login again",
          });
        }

        // Find user and check refresh token
        const user = await Users.findOne({
          where: {
            id: expiredToken.id,
          },
        });

        

        if (!user || !user.refreshToken) {
          return res.status(401).json({
            error: "No refresh token found",
            message: "Please login again to refresh your session",
          });
        }

        try {
          jwt.verify(user.refreshToken, process.env.JWT_SECRET);
        } catch (refreshErr) {
          user.refreshToken = null;
          await user.save();

          return res.status(401).json({
            error: "Refresh token expired",
            message: "Please login again to refresh your session",
          });
        }


        const newToken = jwt.sign(
          { id: user.id, email: user.email, roleId: user.roleId },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );
        const newRefreshToken = jwt.sign(
          { id: user.id },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        user.refreshToken = newRefreshToken;
        await user.save();

        res.set({
          "X-Access-Token": newToken,
          "X-Refresh-Token": newRefreshToken,
        });

        req.userId = user.id;
        next();
      } catch (refreshErr) {
        console.error("Refresh token error:", refreshErr);
        return res.status(401).json({
          error: "Failed to refresh token",
          message: "Please login again to refresh your session",
        });
      }
    } else {
      console.error("Token verification error:", err);
      return res.status(500).json({
        error: "Failed to authenticate token",
        message: "Authentication failed. Please try again.",
      });
    }
  }
};

const refreshToken = async (req, res) => {
  try {
    const currentRefreshToken = req.body.refreshToken;
    console.log("currentRefreshToken", currentRefreshToken);
    if (!currentRefreshToken) {
      return res.status(403).json({
        error: "No refresh token provided",
        message: "Please provide a refresh token",
      });
    }

    const decoded = jwt.verify(currentRefreshToken, process.env.JWT_SECRET);

    const user = await Users.findOne({
      where: {
        id: decoded.id,
        refreshToken: currentRefreshToken,
      },
    });

    if (!user) {
      return res.status(403).json({
        error: "Invalid refresh token",
        message: "Please login again to refresh your session",
      });
    }

    const newToken = jwt.sign(
      { id: user.id, email: user.email, roleId: user.roleId },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const newRefreshToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    user.refreshToken = newRefreshToken;
    await user.save();

    return res.status(200).json({
      message: "Token refreshed successfully",
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Refresh token expired",
        message: "Please login again to refresh your session",
      });
    }

    console.error("Refresh token error:", err);
    return res.status(500).json({
      error: "Failed to refresh token",
      message: "Authentication failed. Please try again.",
    });
  }
};

const isUsersLogin = async (req) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return false;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return false;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return !!decoded;
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      try {
        const expiredToken = jwt.decode(token);
        if (!expiredToken?.id) {
          return false;
        }

        const user = await Users.findByPk(expiredToken.id);
        if (!user?.refreshToken) {
          return false;
        }

        try {
          jwt.verify(user.refreshToken, process.env.JWT_SECRET);
          return true;
        } catch (refreshErr) {
          return false;
        }
      } catch (refreshErr) {
        console.error("isUsersLogin refresh verification error:", refreshErr);
        return false;
      }
    }
    console.error("isUsersLogin token verification error:", err);
    return false;
  }
};

module.exports = {
  verifyToken,
  refreshToken,
  isUsersLogin,
};
