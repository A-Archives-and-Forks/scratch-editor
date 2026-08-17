import log from './log';

/**
 * The renderer's canvas is sized for the stage as it is currently
 * displayed and is multiplied by the device pixel ratio, so its
 * snapshots vary in size between stage size modes and
 * between displays. Scaling to fixed dimensions keeps stored thumbnails consistent.
 */
const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_HEIGHT = 360;

const scaleToThumbnailSize = (snapshotDataURI, callback, onError) => {
    const image = new Image();
    image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = THUMBNAIL_WIDTH;
        canvas.height = THUMBNAIL_HEIGHT;
        canvas
            .getContext('2d')
            .drawImage(image, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
        callback(canvas.toDataURL());
    };
    image.onerror = e => {
        log.error('Project thumbnail scale error', e);
        onError?.(e);
    };
    image.src = snapshotDataURI;
};

export const storeProjectThumbnail = (vm, callback, onError) => {
    try {
        getProjectThumbnail(vm, callback, onError);
    } catch (e) {
        log.error('Project thumbnail save error', e);
        onError?.(e);
    }
};

export const getProjectThumbnail = (vm, callback, onError) => {
    vm.postIOData('video', {forceTransparentPreview: true});
    vm.renderer.requestSnapshot(dataURI => {
        vm.postIOData('video', {forceTransparentPreview: false});
        scaleToThumbnailSize(dataURI, callback, onError);
    });
    vm.renderer.draw();
};
