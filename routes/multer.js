const multer = require("multer")
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images/uploads')
    },
    filename: function (req, file, cb) {
        const uniquename = uuidv4();
        cb(null, uniquename + path.extname(file.originalname));
    }
});
// File filter to allow only MP4 files
const videoFileFilter = function (req, file, cb) {
    if (file.mimetype === 'video/mp4') {
        cb(null, true);
    } else {
        cb(new Error('Only .mp4 files are allowed!'), false);
    }
};

// File filter to allow only image files (jpg, jpeg, png)
const imageFileFilter = function (req, file, cb) {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
        cb(null, true);
    } else {
        cb(new Error('Only .jpg, .jpeg, and .png files are allowed!'), false);
    }
};

const uploadVideo = multer({
    storage: storage,
    fileFilter: videoFileFilter // Apply file filter
});

const uploadImage = multer({
    storage: storage,
    fileFilter: imageFileFilter // Apply image file filter
});

module.exports = {
    uploadVideo,
    uploadImage
};