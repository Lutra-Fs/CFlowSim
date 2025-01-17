import { Button, Space } from 'antd';
import styled from 'styled-components';
import { type ModelSave } from '../services/model/modelService';
import { useEffect } from 'react';
import {
  RunnerFunc,
  type IncomingMessage,
} from '../workers/modelWorkerMessage.ts';

export const ControlBarContainer = styled(Space)`
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  z-index: 100;
  display: flex;
`;

export const SaveBtn = styled(Button)`
  position: absolute;
  bottom: 4rem;
  right: 11rem;
  color: #eeeeee;
  background-color: #555555;
  height: 3.2rem;
  width: 8rem;
  margin: 0 0.2rem;
  cursor: pointer;
  @media (max-width: 760px) {
    margin-bottom: 0.2rem;
  }
`;

export const RestoreBtn = styled(Button)`
  position: absolute;
  bottom: 4rem;
  right: 2rem;
  color: #eeeeee;
  background-color: #555555;
  height: 3.2rem;
  width: 8rem;
  margin: 0 0.2rem;
  cursor: pointer;
  @media (max-width: 760px) {
    margin-bottom: 0.2rem;
  }
`;

interface ControlBarProps {
  modelSaveSubs: Array<(save: ModelSave) => void>;
  worker: Worker;
  setRestorePopupVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ControlBar(props: ControlBarProps): JSX.Element {
  const { modelSaveSubs, worker, setRestorePopupVisible } = props;

  useEffect(() => {
    if (!modelSaveSubs.includes(save)) {
      modelSaveSubs.push(save);
    }
    return () => {
      const index = modelSaveSubs.findIndex((value) => value === save);
      if (index !== -1) {
        modelSaveSubs.splice(index, 1);
      }
    };
  }, [modelSaveSubs]);

  // take the json and have the user download it
  function save(sav: ModelSave): void {
    const filename = `${sav.modelType}@${sav.time}.json`;
    const dat = JSON.stringify(sav);
    const blob = new Blob([dat], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);

    link.click();

    URL.revokeObjectURL(url);
    document.body.removeChild(link);

    console.log('wrote a save to ' + filename, sav);
  }

  // take a file and send its contents to the worker

  return (
    <>
      <SaveBtn
        onClick={() => {
          worker.postMessage({
            func: RunnerFunc.SERIALIZE,
          } satisfies IncomingMessage);
        }}
      >
        Save Model
      </SaveBtn>
      <RestoreBtn
        onClick={() => {
          // create a RestorePopup component to handle input
          setRestorePopupVisible(true);
        }}
      >
        Restore Model
      </RestoreBtn>
      <ControlBarContainer size="small" direction="horizontal">
        <Button
          onClick={() => {
            worker.postMessage({
              func: RunnerFunc.START,
            } satisfies IncomingMessage);
          }}
        >
          Play
        </Button>
        <Button
          onClick={() => {
            worker.postMessage({
              func: RunnerFunc.PAUSE,
            } satisfies IncomingMessage);
          }}
        >
          Pause
        </Button>
        <Button onClick={() => {}}>Stop</Button>
        <Button
          onClick={() => {
            worker.terminate();
          }}
        >
          TERMINATE
        </Button>
      </ControlBarContainer>
    </>
  );
}
