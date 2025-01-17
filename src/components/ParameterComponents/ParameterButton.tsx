import styled from 'styled-components';

const ParamButton = styled.button`
  border-radius: 20px;
  height: 35px;
  width: 100%;
  padding: 10px 20px 7px 20px;
  background-color: #d9d9d9;
  color: #464646;
  font-size: 14px;
  border: none;
  cursor: pointer;
`;

export default function ParameterButton(props: {
  label: string;
  onClick?: () => void;
}): JSX.Element {
  return <ParamButton onClick={props.onClick}>{props.label}</ParamButton>;
}
