import { getAsJson } from "@/app/util/util";
import { FormEvent,  useEffect, useState } from "react"

export default function TpLinkSwitch({ apiData, deviceIp }: { apiData?: {}, deviceIp: string }) {

  const [state, setState] = useState<boolean>(false);
  // const { data, error, isLoading } = useSWR('/api/smart/switch/info', fetcher);

  const [deviceName, setDeviceName] = useState<string>();
  // const [deviceIp, setDeviceIp] = useState<string>();


  const getInfo = () => {
    fetch('/api/smart/switch/info')
      .then(getAsJson)
      .then((jsonWrap) => {
        if (jsonWrap?.data) {
          const data = jsonWrap.data;
          setDeviceName(data.sysInfo?.alias);
        }
      });
  }

  const toggle = () => {
    console.log("toggle " + convBoolState(!state));
    fetch(`/api/smart/switch/${convBoolState(!state)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        body: convBoolState(state),
      },
      // body: JSON.stringify(objectWithData),
    })
      .then(getAsJson)
      .then(jsonWrap => {
        if (jsonWrap?.data) {
          const data = jsonWrap.data;
          console.log("toggled " + JSON.stringify(data));
          const boolState = convStringState(data.deviceStatus);
          setState(boolState);
        }
      })
  }

  const convBoolState = (state: boolean) => {
    return state ? 'on' : 'off'
  }

  const convStringState = (state: string): boolean => {
    return !!state && state === 'on';
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    test();
    alert("A name was submitted");
    event.preventDefault();
  }

  const test = () => {
    setDeviceName("hej");
  }

  useEffect(() => {
    console.log(JSON.stringify(apiData));
  }, [apiData]);

  const onsubmit = (e: { preventDefault: () => void; }) =>{
    e.preventDefault();
    alert("hej");
  }

  return <div className="gap-4">
    {/* https://nextui.org/docs/components/switch */}
    <form onSubmit={onsubmit}>
      {/* <input hidden readOnly name="action" value="toggle"></input>
      <input hidden readOnly name="state" value={convBoolState(!state)}></input> */}
      <input type="submit" className="border cursor-pointer" value="iPad friendly toggle"></input>
    </form>
    <div>
      {deviceName}
      {JSON.stringify(apiData)}
    </div>
  </div>
}