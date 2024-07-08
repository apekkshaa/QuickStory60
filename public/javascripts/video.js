// Toggle mute/unmute icon
function toggleMute(button) {
    let videoId = button.getAttribute('data-video-id');
    let video = document.getElementById('video-' + videoId);

    if (video.muted) {
        video.muted = false;
        button.innerHTML = '<i class="ri-volume-up-fill"></i>';
    } else {
        video.muted = true;
        button.innerHTML = '<i class="ri-volume-mute-fill"></i>';
    }
}
