import { useState, type JSX } from 'react';

export default function DropdownParameter(props: {
  onChange: (value: string) => void
  values: string[]
  initValue?: string
}): JSX.Element {
  const [value, setValue] = useState(props.values[0])
  if (props.initValue !== undefined) {
    setValue(props.initValue)
  }
  return (
    <select
      value={value}
      onChange={e => {
        setValue(e.target.value)
        props.onChange(e.target.value)
      }}
      className="block appearance-none -webkit-appearance-none w-[15rem] border border-black bg-[rgb(217,217,217)] my-1 mx-0 px-1 h-6"
    >
      {props.values.map(val => (
        // use value as key, this asserts that the values are unique
        // CAUTION: this is true when I wrote this, but may not be true in the future
        (<option key={val} value={val}>
          {val}
        </option>)
      ))}
    </select>
  );
}
