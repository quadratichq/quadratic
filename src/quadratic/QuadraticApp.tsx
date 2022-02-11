import { useEffect } from "react";
import QuadraticUI from "../ui/QuadraticUI";
import QuadraticGrid from "../core/gridGL/QuadraticGrid";
import { RecoilRoot } from "recoil";
import { MemoryRouter } from "react-router-dom";
import { useLoading } from "../contexts/LoadingContext";
import { QuadraticLoading } from "../ui/QuadtraticLoading";
import { loadPython } from "../core/commands/python/loadPython";
import { runMain } from "module";
import { runPython } from "../core/commands/python/runPython";
import { AnyNaptrRecord } from "dns";

export default function QuadraticApp() {
  const { loading, setLoading } = useLoading();

  useEffect(() => {
    if (loading) {
      loadPython().then(() => {
        setLoading(false);
      });
    }
  }, [setLoading]);

  return (
    <RecoilRoot>
      <MemoryRouter>
        {/* Provider of WebGL Canvas and Quadratic Grid */}
        <QuadraticGrid></QuadraticGrid>
        {/* Provider of All React UI Components */}
        <QuadraticUI></QuadraticUI>
        {/* Loading screen */}
        {loading && <QuadraticLoading></QuadraticLoading>}
      </MemoryRouter>
    </RecoilRoot>
  );
}
