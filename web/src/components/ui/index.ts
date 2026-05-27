// Design-system primitives. Import via the barrel:
//   import { Button, Field, Input, Tag } from "../components/ui";
//
// Each primitive lives in its own file so the imports are tree-shakeable
// and components can be edited without touching unrelated parts of the
// system. Conventions documented in each file's JSDoc — read those before
// extending or duplicating.

export { Button } from "./Button";
export { ConfirmDialog } from "./ConfirmDialog";
export { Eyebrow } from "./Eyebrow";
export { Field } from "./Field";
export { Icon, type IconName } from "./Icon";
export { Input } from "./Input";
export { MetaRow } from "./MetaRow";
export { SprigDivider } from "./SprigDivider";
export { Tag, tagToneFor, type TagTone } from "./Tag";
export { Textarea } from "./Textarea";
export { Toast } from "./Toast";
