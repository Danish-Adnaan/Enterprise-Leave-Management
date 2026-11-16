function validateLogin(req, res, next){

    const { username, password, role } = req.body;


    if (!username || !password || !role){
        return res.status(400).json({
            message:"Username, Password and Role is required"
        });
    }

    next();
}

module.exports = validateLogin