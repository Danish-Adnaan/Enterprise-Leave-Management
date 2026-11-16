function isValidDate(dateString){
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (!datePattern.test(dateString)){
        return false
    }

    const date = new Date(`${dateString}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateString;
}


function validateLeave(req,res,next){
    const {leave_type, start_date, end_date, reason } = req.body;

    if(!leave_type || !start_date || !end_date){
        return res.status(400).json({
            message:"leave_type, start_date and end_date are required"
        });

    }

    if (typeof start_date !== "string" || typeof end_date !== "string") {
    return res.status(400).json({
        message: "start_date and end_date must be strings"
    });
}


    if (!isValidDate(start_date) || !isValidDate(end_date)){
        return res.status(400).json({
            message: "Dates must be in YYYY-MM-DD format"
        });
    }

    if (end_date < start_date){
        return res.status(400).json({
            message:"End date must be greater than or equal to start date"
        })
    }

    if(reason !== undefined && typeof reason !== "string"){
        return res.status(400).json({
            message:"Reason must be a string"
        })
    }

    if (reason && reason.length >500){
        return res.status(400).json({
            message:"Reason cannot exceed 500 characters"
        })
    }

    next();
}

module.exports = validateLeave;