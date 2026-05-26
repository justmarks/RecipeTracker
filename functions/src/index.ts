import {setGlobalOptions} from "firebase-functions";

setGlobalOptions({maxInstances: 10});

export {importFromUrl} from "./importFromUrl";
