import { useState } from "react";
import { ethers } from "ethers";

const abi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)"
];

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;

export default function App() {
  const [account, setAccount] = useState<string>("");
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [decimals, setDecimals] = useState<number>(18);
  const [balance, setBalance] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  async function connect() {
    try {
      const eth = (window as any).ethereum;
      if (!eth) { setMsg("MetaMask nie je dostupný."); return; }

      const provider = new ethers.BrowserProvider(eth);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setAccount(addr);

      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) setMsg("Prepni sa na Sepolia test network v MetaMask."); else setMsg("");

      const token = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
      const [n, s, d] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
      setTokenName(n); setTokenSymbol(s); setDecimals(Number(d));

      const bal = await token.balanceOf(addr);
      setBalance(ethers.formatUnits(bal, Number(d)));
    } catch (e:any) {
      setMsg(e?.message ?? String(e));
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", fontFamily: "Inter, system-ui, Arial" }}>
      <h2>SimpleToken dApp</h2>
      <button onClick={connect} style={{ padding: "10px 14px", borderRadius: 10 }}>
        {account ? "Connected ?" : "Connect Wallet"}
      </button>

      {account && (
        <div style={{ marginTop: 16 }}>
          <div><b>Account:</b> {account}</div>
          <div><b>Network:</b> Sepolia (expected)</div>
          <div style={{ marginTop: 8 }}>
            <b>Token:</b> {tokenName} ({tokenSymbol})<br/>
            <b>Balance:</b> {balance || "0"} {tokenSymbol}
          </div>
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 16, padding: 10, background: "#fff3cd", border: "1px solid #ffeeba", borderRadius: 8 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
