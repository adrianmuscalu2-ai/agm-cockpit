export type BrowserCameraCaptureResult =
  | { status: 'captured'; file: File }
  | { status: 'cancelled' | 'permission-denied' | 'camera-unavailable' };

type CaptureLabels = {
  title: string;
  description: string;
  capture: string;
  cancel: string;
};

const MOBILE_BROWSER = /Android|iPhone|iPad|iPod|Mobile/i;

export function shouldUseDesktopWebcam(userAgent = navigator.userAgent) {
  return !MOBILE_BROWSER.test(userAgent) && Boolean(navigator.mediaDevices?.getUserMedia);
}

export async function captureFromDesktopWebcam(labels: CaptureLabels): Promise<BrowserCameraCaptureResult> {
  if (!navigator.mediaDevices?.getUserMedia) return { status: 'camera-unavailable' };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: { ideal: 'environment' } },
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return { status: 'permission-denied' };
    return { status: 'camera-unavailable' };
  }

  const overlay = document.createElement('div');
  overlay.className = 'browser-camera-capture-overlay';
  overlay.innerHTML = `<section class=browser-camera-capture-dialog role=dialog aria-modal=true aria-labelledby=browser-camera-title>
    <header><div><span>WEBCAM / OCR</span><h2 id=browser-camera-title></h2><p></p></div></header>
    <video id=browserCameraPreview autoplay playsinline muted></video>
    <footer><button id=browserCameraCancel type=button></button><button id=browserCameraShutter class=primary type=button></button></footer>
  </section>`;
  const title = overlay.querySelector<HTMLHeadingElement>('#browser-camera-title');
  const description = overlay.querySelector<HTMLParagraphElement>('header p');
  const cancel = overlay.querySelector<HTMLButtonElement>('#browserCameraCancel');
  const shutter = overlay.querySelector<HTMLButtonElement>('#browserCameraShutter');
  const video = overlay.querySelector<HTMLVideoElement>('#browserCameraPreview');

  if (!title || !description || !cancel || !shutter || !video) {
    stream.getTracks().forEach((track) => track.stop());
    return { status: 'camera-unavailable' };
  }

  title.textContent = labels.title;
  description.textContent = labels.description;
  cancel.textContent = labels.cancel;
  shutter.textContent = labels.capture;
  video.srcObject = stream;
  document.body.append(overlay);

  try {
    await video.play();
  } catch {
    overlay.remove();
    stream.getTracks().forEach((track) => track.stop());
    return { status: 'camera-unavailable' };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: BrowserCameraCaptureResult) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown);
      stream.getTracks().forEach((track) => track.stop());
      overlay.remove();
      resolve(result);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish({ status: 'cancelled' });
    };

    cancel.addEventListener('click', () => finish({ status: 'cancelled' }));
    shutter.addEventListener('click', () => {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        finish({ status: 'camera-unavailable' });
        return;
      }
      context.drawImage(video, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          finish({ status: 'camera-unavailable' });
          return;
        }
        finish({
          status: 'captured',
          file: new File([blob], `agm-webcam-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }),
        });
      }, 'image/jpeg', 0.92);
    });
    document.addEventListener('keydown', onKeyDown);
    shutter.focus();
  });
}
