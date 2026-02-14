import type { FieldType } from "@formant/core";
import { Welcome } from "./Welcome";
import { TextInput } from "./TextInput";
import { NumberInput } from "./NumberInput";
import { TextArea } from "./TextArea";
import { Choice } from "./Choice";
import { MultiChoice } from "./MultiChoice";
import { Rating } from "./Rating";
import { Scale } from "./Scale";
import { YesNo } from "./YesNo";
import { DateInput } from "./DateInput";
import { Dropdown } from "./Dropdown";
import { Statement } from "./Statement";
import { Ending } from "./Ending";

export type { QuestionProps } from "./types";
export type { EndingComponentProps } from "./Ending";

// Re-export all components
export {
  Welcome,
  TextInput,
  NumberInput,
  TextArea,
  Choice,
  MultiChoice,
  Rating,
  Scale,
  YesNo,
  DateInput,
  Dropdown,
  Statement,
  Ending,
};

// Map field type to component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const questionRegistry: Record<FieldType, React.ComponentType<any>> = {
  welcome: Welcome,
  text: TextInput,
  email: TextInput,
  phone: TextInput,
  url: TextInput,
  number: NumberInput,
  textarea: TextArea,
  choice: Choice,
  multi_choice: MultiChoice,
  rating: Rating,
  scale: Scale,
  yes_no: YesNo,
  date: DateInput,
  dropdown: Dropdown,
  statement: Statement,
  ending: Ending,
};
