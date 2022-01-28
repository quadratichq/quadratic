export default interface APICell {
  x: number;
  y: number;
  input_type: "TEXT" | "FORMULA" | "JAVASCRIPT" | "PYTHON";
  input_value: string;
}
