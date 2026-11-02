export async function playMattAudio(player) {
  if (!player?.srcObject?.getAudioTracks().some((track) => track.readyState === "live" && track.enabled)) {
    throw new Error("The live provider has not supplied an active audio track. No substitute voice will be played.");
  }
  player.muted = false;
  player.volume = 1;
  await player.play();
  if (player.paused || player.muted || player.volume === 0) {
    throw new Error("Live audio playback did not start. Enable audio and check the browser tab and device output.");
  }
}
