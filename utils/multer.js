// for converting to smaller image size
const multer = require('multer') // file upload in strings
const path = require('path')



module.exports = multer({
    storage: multer.diskStorage({}),
    fileFilter: (req, file, cb) => {
        let ext = path.extname(file.originalname);
        if (![".jpg", ".jpeg", ".png", ".gif", ".mkv", ".mp4", ".pdf"].includes(ext)) {
            cb(new Error("File type is not supported"), false);
            return;
        }
        cb(null, true);
    }
});