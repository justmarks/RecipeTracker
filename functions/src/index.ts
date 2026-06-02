import {setGlobalOptions} from "firebase-functions";

setGlobalOptions({maxInstances: 10});

export {importFromUrl} from "./importFromUrl";
export {importFromImage} from "./importFromImage";
export {shareRecipe, unshareRecipe} from "./shareRecipe";
export {grantAutoShare, revokeAutoShare} from "./autoShare";
export {generateGroceryList} from "./generateGroceryList";
export {
  cleanupRecipePhotoOnDelete,
  cleanupRecipePhotoOnUpdate,
} from "./photoCleanup";
