const bcrypt = require("bcrypt");
const pool = require("../db");
const jwt = require("jsonwebtoken")

async function login(req, res,next) {

    const username = req.body.username;
    const password = req.body.password;
    const role = req.body.role;

    try{
        const result = await pool.query(`
            select id, username, password_hash, role, is_active
            from users 
            where username = $1`, [username]);

        if(result.rows.length === 0){
            return res.status(401).json({
                message:"Invalid Credentials"
            })
        }

        const user = result.rows[0]

        if (!user.is_active){
            return res.status(401).json({
                message:"Invalid credentials"
            })
        }
        
        const passwordMatches = await bcrypt.compare(password,user.password_hash)

        if (!passwordMatches){
            return res.status(401).json({
                message:"Invalid Credentials"
            })
        }

        if (user.role !== role){
            return res.status(401).json({
                message:"Invalid Credentials/Role"
            })
        }

        const token = jwt.sign({
            id: user.id,
            username: user.username,
            role: user.role
        }, process.env.JWT_SECRET, {
            expiresIn:"1h"
        })

        res.status(200).json({
            message:"Login Successful",
            token: token,
            username: user.username,
            role: user.role
        })
    }
    catch (error){
        console.error("Login Error", error)

        next(error);
    }
}

module.exports = { login }