const cloudinary = require("./cloudinary");
const streamifier = require("streamifier");

const uploadBuffer = (buffer, folder, resourceType = "image") => {
    return new Promise((resolve, reject) => {

        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: resourceType,
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );

        streamifier.createReadStream(buffer).pipe(stream);
    });
};

module.exports = uploadBuffer;