// Used to coerce bigints to numbers for JSON.stringify; see
// https://github.com/GoogleChromeLabs/jsbi/issues/30#issuecomment-2064279949.
export const bigIntReplacer = (_key: string, value: any): any => {
  return typeof value === 'bigint' ? Number(value) : value;
};

// export const parseWithBigInt = (jsonString, bigNumChecker) =>
//   JSON.parse(enquoteBigNumber(jsonString, bigNumChecker), (key, value) =>
//     !isNaN(value) && bigNumChecker(value) ? BigInt(value) : value
//   );
