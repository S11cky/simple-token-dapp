import { useState, useEffect } from "react";
import { ethers } from "ethers";
import abi from "./abi.json"; // uisti sa, že máš ABI v src/abi.json

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

function App() {
  const [account, setAccount] = useState<string>("");
  const [balance, setBalance] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  // Helper
  function short(addr: string) {
    return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";
  }

  async function connect() {
    try {
      setMsg("");
      const anyWin = window as any;
      let eth = anyWin.ethereum;

      if (eth?.providers?.length) {
        // ak je viac providerov (napr. Brave + MetaMask), vyberieme MetaMask
        eth = eth.providers.find((p: any) => p.isMetaMask) ?? eth.providers[0];
      }

      if (!eth?.request) {
        setMsg("MetaMask provider nebol nájdený.");
        return;
      }

      const [addr] = await eth.request({ method: "eth_requestAccounts" });
      setAccount(addr);

      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      const d: number = await token.decimals();
      const bal = await token.balanceOf(addr);
      setBalance(ethers.formatUnits(bal, d));
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function send() {
    try {
      setMsg("");
      setTxHash("");
      if (!account) {
        setMsg("Najprv sa pripoj peňaženkou.");
        return;
      }

      const anyWin = window as any;
      let eth = anyWin.ethereum;
      if (eth?.providers?.length) {
        eth = eth.providers.find((p: any) => p.isMetaMask) ?? eth.providers[0];
      }
      if (!eth?.request) {
        setMsg("MetaMask provider nebol nájdený.");
        return;
      }

      if (!ethers.isAddress(to)) {
        setMsg("Neplatná adresa príjemcu.");
        return;
      }

      const amt = amount.trim();
      if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) {
        setMsg("Zadaj kladnú sumu.");
        return;
      }

      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      const d: number = await token.decimals();
      const value = ethers.parseUnits(amt, d);

      setSending(true);
      const tx = await token.transfer(to, value);
      setTxHash(tx.hash);

      const receipt = await tx.wait(); // čaká na potvrdenie
      const bal = await token.balanceOf(await signer.getAddress());
      setBalance(ethers.formatUnits(bal, d));
      setMsg(`Hotovo: ${receipt?.status === 1 ? "úspech" : "neznámy stav"}`);
    } catch (e: any) {
      if (e?.code === 4001) setMsg("Transakcia odmietnutá v MetaMask.");
      else setMsg(e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>SimpleToken dApp</h1>

      {!account && (
        <button
          onClick={connect}
          style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
        >
          Connect Wallet
        </button>
      )}

      {account && (
        <div>
          <p>
            <b>Account:</b> {short(account)}
          </p>
          <p>
            <b>Balance:</b> {balance} STK
          </p>
        </div>
      )}

      {account && (
        <div style={{ marginTop: 20, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <h3>Send STK</h3>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              placeholder="Recipient address (0x...)"
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
            />
            <input
              placeholder="Amount (e.g. 1.5)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
            />
            <button
              onClick={send}
              disabled={sending}
              style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
            >
              {sending ? "Sending..." : "Send STK"}
            </button>
          </div>

          {txHash && (
            <div style={{ marginTop: 10 }}>
              <b>Tx:</b>{" "}
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {short(txHash)}
              </a>
            </div>
          )}
        </div>
      )}

      {msg && (
        <p style={{ marginTop: 20, color: "crimson" }}>
          <b>{msg}</b>
        </p>
      )}
    </div>
  );
}

export default App;
