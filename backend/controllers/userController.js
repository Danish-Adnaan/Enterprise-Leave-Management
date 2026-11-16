const bcrypt = require("bcrypt");
const pool = require("../db");

async function getCurrentUser(req, res, next) {
    try {
        const result = await pool.query(`
            SELECT id, username, role, created_at
            FROM users
            WHERE id = $1 AND is_active = TRUE`,
            [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "User retrieved successfully",
            user: result.rows[0]
        });
    } catch (error) {
        return next(error);
    }
}

async function getAllUsers(req, res, next) {
    try{
        const result = await pool.query(`
            select id, username, role, created_at, is_active
            from users
            where is_Active = TRUE
            order by created_at asc`);

        return res.status(200).json({
            message:"Users retrieved successfully",
            users: result.rows
        });
    }
    catch (error){
        next(error);
    }
}

async function createUser(req, res, next){
    const {username, role} = req.body;

    if (typeof username !== "string" || username.trim() === "" ||
        username.trim().length > 255 ||
        ! ["employee","manager"].includes(role)) {
            return res.status(400).json({
                message:"A valid username and role (employee or manager) are required"
            });
        }

    const normalizedUsername = username.trim();

    let client;

    try{
        client = await pool.connect();
        await client.query("BEGIN");

        const insertResult = await client.query(`
            insert into users (username, password_hash, role)
            values ($1,$2,$3)
            returning id, username, role, created_at, is_active`,[normalizedUsername,"pending",role]);

        const newUser = insertResult.rows[0];

        const defaultPassword = `${newUser.username}@${newUser.id}`;

        const passwordHash = await bcrypt.hash(defaultPassword, 12)

        await client.query(`update users
            set password_hash = $1
            where id = $2`, [passwordHash,newUser.id]);
        
        await client.query("COMMIT");

        return res.status(201).json({
            message:"User created successfully",
            user: newUser, defaultPassword
        });

    }
    catch(error){
        if(client){
            try{
                await client.query("ROLLBACK")
            } catch (rollbackError){
                console.error("Rollback failed: ", rollbackError)
            }
        }
        if (error.code === "23505"){
            return res.status(409).json({
                message: "username already exists"
            });
        }

        return next(error);
    }

    finally{
        if(client){
            client.release();
        }
    }
}    



async function deactivateUser(req, res, next){
    const {id} = req.params;
    const managerId = req.user.id;

    if(!/^[1-9]\d*$/.test(id)){
        return res.status(400).json({
            message:"Inavlid user ID"
        });
    }

    if (String(id) === String(managerId)){
        return res.status(400).json({
            message: "You cannot deactivate your own account"
        });
    }

    let client;

    try{
        client = await pool.connect();
        await client.query("BEGIN");

        await client.query(`select id
            from users
            where role = 'manager'
            order by id
            for update`)

        const targetResult = await client.query(`
            select id, username, role, is_active
            from users
            where id = $1
            for update`, [id]);
        
        if (targetResult.rows.length === 0){
            await client.query("ROLLBACK");
            return res.status(404).json({
                message:"User not found"
            });
        }

        const target = targetResult.rows[0];

        if (!target.is_active){
            await client.query("ROLLBACK");
            return res.status(409).json({

                message:"User is already inactive"
            });
        }

        if (target.role === "manager") {
            const activeManagers = await client.query(`
                select count(*) as count
                from users 
                where role = 'manager' AND is_active = TRUE`);
            
                if(Number(activeManagers.rows[0].count) <= 1){
                    await client.query("ROLLBACK");
                    return res.status(409).json({
                        message:"Cannot deactivate the last active manager"
                    });
                }
        }

        const result = await client.query(`
            update users set is_active = FALSE
            where id = $1
            and is_active = TRUE
            returning id, username, role, created_at, is_active`, [id]);

        if (result.rows.length === 0){
            await client.query("ROLLBACK");
            return res.status(409).json({
                message:"User could not be deactivated"
            });
        }

        await client.query("COMMIT");

        return res.status(200).json({
            message: "User deactivated successfully",
            user: result.rows[0]
        });
    }
     catch(error){
        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch(rollbackError){
                console.error("Rollback failed", rollbackError);
            }
        }

        return next(error);
    } finally{
        if(client) {
            client.release();
        }

     }
}

async function changePassword(req, res, next){
    const {currentPassword, newPassword} = req.body;
    const userId = req.user.id

    if(typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        newPassword.length < 12 ||
        newPassword.length > 72
    ){ return res.status(400).json({
        message: "Current Password and new Password of 12-72 characters are required"
    });
    }

    if (currentPassword === newPassword){
        return res.status(400).json({
            message:"New Password must differ from the current password"
        });
    }

    try{
        const result = await pool.query(`select password_hash from users
            where id = $1 and is_active = TRUE`, [userId]);

            if (result.rows.length === 0) {
                return res.status(401).json({

                    message:"Invalid or inactive account"
                });
            }

            const passwordMatches = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

            if(!passwordMatches){
                return res.status(401).json({
                    message:"current password is incorrect"
                });
            }

            const newPasswordHash = await bcrypt.hash(newPassword,12)

            const updateResult = await pool.query(`update users
                set password_hash = $1
                where id = $2 and is_active = TRUE and password_hash = $3 
                returning id`, [newPasswordHash, userId, result.rows[0].password_hash]);

                if(updateResult.rows.length === 0) {
                    return res.status(409).json({

                        message:"Account changed during the operation please try again"
                    })
                }

                return res.status(200).json({
                    message:"Password changed successfully"
                });
    } catch (error){
        return next(error);
    }
}




module.exports = {getCurrentUser, getAllUsers, createUser, deactivateUser, changePassword};