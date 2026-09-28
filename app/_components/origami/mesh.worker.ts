// Builds the animal meshes off the main thread; posts each one as soon as it's ready.
import { ANIMALS, BALL_PAPER } from "./animals";
import { meshSculpt } from "./sculpt";

const CELL = 0.03; // grid cell size in world units — sets triangle density

self.onmessage = () => {
  ANIMALS.forEach((animal, index) => {
    const m = meshSculpt(animal.build(), CELL, BALL_PAPER, animal.scale);
    (self as unknown as Worker).postMessage({ index, ...m }, [
      m.positions.buffer,
      m.ball.buffer,
      m.colors.buffer,
      m.ballColors.buffer,
    ]);
  });
};
