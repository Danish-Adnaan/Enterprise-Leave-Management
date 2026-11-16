const jwt  = require("jsonwebtoken");
const pool = require("../db")


async function authenticateToken(req,res,next){
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")){
        return res.status(401).json({
            message:"Authentication token is required"
        })
    }

    const token = authHeader.split(" ")[1];

    if(!token){
        return res.status(401).json({
            message: "Authentication token is required"
        })
    }

    try{
       const decoded = jwt.verify(token, process.env.JWT_Secret);

       const result = await pool.query(`select id, username, role
        from users where id = $1 and is_active = TRUE`, [decoded.id]);

        if(result.rows.length === 0) {
            return res.status(401).json({
                message:"Invalid or inactive account"
            });
        }

        const user = result.rows[0]

        req.user = {
            id: user.id,
            username: user.username,
            role: user.role
        }

        next()
        
    } catch (error){
        if(error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.name === "NotBeforeError"
        ) {
            return res.status(401).json({
                message: "Invalid or expired token"
            });
        }

        return next(error);
    }
}

module.exports = authenticateToken;