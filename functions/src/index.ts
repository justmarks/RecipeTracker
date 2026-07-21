import {startInstrumentation} from "./instrumentation";
import {setGlobalOptions} from "firebase-functions";

startInstrumentation();
setGlobalOptions({maxInstances: 10});

export {importFromUrl} from "./importFromUrl";
export {importFromImage} from "./importFromImage";
export {shareRecipe, unshareRecipe} from "./shareRecipe";
export {shareMealPlan, unshareMealPlan} from "./shareMealPlan";
export {grantAutoShare, revokeAutoShare} from "./autoShare";
export {generateGroceryList} from "./generateGroceryList";
export {
  cleanupRecipePhotoOnDelete,
  cleanupRecipePhotoOnUpdate,
} from "./photoCleanup";
