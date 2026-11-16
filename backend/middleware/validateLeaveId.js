function validateLeaveId(req, res, next) {
    const { id }  = req.params;
    

    /* !/^\d+$/ Means a regular expression test */
    if (!/^\d+$/.test(id)){
        return res.status(400).json({
            message: "Leave ID must be a positive Integer"
        });
    }

    if(!Number.isSafeInteger(Number(id)) || Number(id) <= 0){
        return res.status(400).json({
            message:"Leave ID must be a positive safe Integer"
        });
    }

    next();
}

module.exports = validateLeaveId;