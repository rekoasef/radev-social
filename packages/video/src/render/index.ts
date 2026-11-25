// Las composiciones se importan desde acá en el render (no desde el índice del paquete: Remotion y
// React no tienen por qué cargarse donde solo se usan los schemas).
export {
  PHOTO_SIZE,
  PhotoVideo,
  type PhotoVideoProps,
  photoFrames,
  type SceneVoice,
  type Shot,
} from "./PhotoVideo";
export { Root } from "./Root";
export { THUMB_SIZE, Thumb, type ThumbProps } from "./Thumb";
