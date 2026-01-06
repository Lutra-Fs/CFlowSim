import { type JSX, useState } from 'react'

export default function ChoiceParameter(props: {
  onChange: (value: string) => void
  values: string[]
  initValue?: string
}): JSX.Element {
  const [value, setValue] = useState(props.values[0])
  if (props.initValue !== undefined) {
    setValue(props.initValue)
  }
  // split values into rows of 3
  const rows: string[][] = []
  for (let i = 0; i < props.values.length; i += 3) {
    rows.push(props.values.slice(i * 3, i * 3 + 3))
  }

  return (
    <div className="my-1 mx-0">
      {rows.map((row, rowIndex) => (
        // eslint-disable-next-line @eslint-react/jsx/no-array-index-key
        <div key={`row-${rowIndex}-${row.join('-')}`}>
          {row.map(val => (
            <span key={`col-${val}`}>
              <button
                type="button"
                data-value={val}
                onClick={() => {
                  setValue(val)
                  props.onChange(val)
                }}
                className={`appearance-none -webkit-appearance-none border-none px-[15px] py-1 rounded-[calc(1rem+5px)] mr-4 ${
                  val === value
                    ? 'bg-[rgb(42,40,161)] text-white'
                    : 'bg-[rgb(217,217,217)] text-black'
                }`}
              >
                {val}
              </button>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
