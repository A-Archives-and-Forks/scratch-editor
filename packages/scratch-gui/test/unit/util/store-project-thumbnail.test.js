import {getProjectThumbnail, storeProjectThumbnail} from '../../../src/lib/store-project-thumbnail';
import log from '../../../src/lib/log';

describe('getProjectThumbnail', () => {
    const SNAPSHOT_URI = 'data:image/png;base64,snapshot';
    const THUMBNAIL_URI = 'data:image/png;base64,thumbnail';

    let OriginalImage;
    let drawImage;
    let thumbnailCanvas;
    let imageFailsToDecode;

    // Build a VM whose renderer registers a snapshot callback and invokes it on draw, like RenderWebGL does.
    const makeVM = () => {
        const snapshotCallbacks = [];
        return {
            postIOData: jest.fn(),
            renderer: {
                requestSnapshot: jest.fn(cb => snapshotCallbacks.push(cb)),
                draw: jest.fn(() => {
                    snapshotCallbacks
                        .splice(0)
                        .forEach(cb => cb(SNAPSHOT_URI));
                })
            }
        };
    };

    beforeEach(() => {
        drawImage = jest.fn();
        thumbnailCanvas = null;
        imageFailsToDecode = false;

        OriginalImage = global.Image;
        global.Image = class {
            set src (value) {
                this._src = value;
                if (imageFailsToDecode) {
                    this.onerror(new Error('decode failed'));
                } else {
                    this.onload();
                }
            }
            get src () {
                return this._src;
            }
        };

        const createElement = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation(tagName => {
            const element = createElement(tagName);
            if (tagName === 'canvas') {
                thumbnailCanvas = element;
            }
            return element;
        });
        jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            drawImage
        });
        jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
            THUMBNAIL_URI
        );
    });

    afterEach(() => {
        global.Image = OriginalImage;
        jest.restoreAllMocks();
    });

    test('scales the snapshot to 480x360 regardless of the renderer canvas size', () => {
        const callback = jest.fn();

        getProjectThumbnail(makeVM(), callback);

        expect(thumbnailCanvas.width).toBe(480);
        expect(thumbnailCanvas.height).toBe(360);
        expect(drawImage).toHaveBeenCalledWith(
            expect.any(global.Image),
            0,
            0,
            480,
            360
        );
        expect(callback).toHaveBeenCalledWith(THUMBNAIL_URI);
    });

    test('scales the snapshot the renderer produced', () => {
        getProjectThumbnail(makeVM(), jest.fn());

        expect(drawImage.mock.calls[0][0].src).toBe(SNAPSHOT_URI);
    });

    test('restores the video preview before scaling', () => {
        const vm = makeVM();

        getProjectThumbnail(vm, jest.fn());

        expect(vm.postIOData.mock.calls).toEqual([
            ['video', {forceTransparentPreview: true}],
            ['video', {forceTransparentPreview: false}]
        ]);
    });

    test('logs and skips the callback when the snapshot cannot be decoded', () => {
        const logError = jest.spyOn(log, 'error').mockImplementation(() => {});
        const callback = jest.fn();
        imageFailsToDecode = true;

        getProjectThumbnail(makeVM(), callback);

        expect(callback).not.toHaveBeenCalled();
        expect(logError).toHaveBeenCalled();
    });

    test('notifies onError when the snapshot cannot be decoded', () => {
        jest.spyOn(log, 'error').mockImplementation(() => {});
        const onError = jest.fn();
        imageFailsToDecode = true;

        getProjectThumbnail(makeVM(), jest.fn(), onError);

        expect(onError).toHaveBeenCalled();
    });

    test('notifies onError when the snapshot cannot be taken', () => {
        jest.spyOn(log, 'error').mockImplementation(() => {});
        const onError = jest.fn();
        const vm = makeVM();
        vm.renderer.draw = () => {
            throw new Error('renderer exploded');
        };

        storeProjectThumbnail(vm, jest.fn(), onError);

        expect(onError).toHaveBeenCalled();
    });
});
