const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    imageText: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    likeCount: {
        type: Number,
        default: 0
    },
    likes: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        default: []
    }
});

module.exports = mongoose.model('Post', postSchema);

