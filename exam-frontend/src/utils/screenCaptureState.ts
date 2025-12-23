// src/utils/screenCaptureState.ts

let screenCaptureActive = false;

export function setScreenCaptureActive(active: boolean) {
  screenCaptureActive = active;
}

export function isScreenCaptureActive() {
  return screenCaptureActive;
}
