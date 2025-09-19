import { useState } from "react";
import { ethers } from "ethers";

const abi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)"
];

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;

export default function App() {
  const [account, setAccount] = useState<string>("");
  const [tokenName, setTokenName] = useState<string>("");
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [decimals, setDecimals] = useState<number>(18);
  const [balance, setBalance] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const [to, setTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  function short(addr: string) {
    return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";
  }

  async function connect() {
    try {
      setMsg("");
      const anyWin = window as any;
      let eth = anyWin.ethereum;
      if (eth?.providers?.length) {
        eth = eth.providers.find((p: any) => p.isMetaMask) ?? eth.providers[0];
      }
      if (!eth?.request) { setMsg("MetaMask provider nebol nájdený."); return; }

      await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts?.length) { setMsg("Žiadny odomknutý úcet v MetaMask."); return; }
      setAccount(accounts[0]);

      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xAA36A7" }] });
      } catch (e:any) {
        if (e?.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0xAA36A7",
              chainName: "Sepolia",
              nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"]
            }]
          });
        } else { throw e; }
      }

      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      const [n, s, d] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
      setTokenName(n); setTokenSymbol(s); setDecimals(Number(d));

      const bal = await token.balanceOf(accounts[0]);
      setBalance(ethers.formatUnits(bal, Number(d)));
      setMsg("");
    } catch (e:any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function send() {
    try {
      setMsg(""); setTxHash("");
      if (!account) { setMsg("Najprv sa pripoj penaženkou."); return; }
      if (!ethers.isAddress(to)) { setMsg("Neplatná adresa príjemcu."); return; }
      if (!amount || Number(amount) <= 0) { setMsg("Zadaj kladnú sumu."); return; }

      const anyWin = window as any;
      let eth = anyWin.ethereum;
      if (eth?.providers?.length) {
        eth = eth.providers.find((p: any) => p.isMetaMask) ?? eth.providers[0];
      }
      if (!eth?.request) { setMsg("MetaMask provider nebol nájdený."); return; }

      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      const d: number = await token.decimals();
      const value = ethers.parseUnits(amount.trim(), d);

      setSending(true);
      const tx = await token.transfer(to, value);
      setTxHash(tx.hash);
      await tx.wait();

      const bal = await token.balanceOf(await signer.getAddress());
      setBalance(ethers.formatUnits(bal, d));
      setMsg("Transakcia odoslaná a potvrdená.");
    } catch (e:any) {
      if (e?.code === 4001) setMsg("Transakcia odmietnutá v MetaMask.");
      else setMsg(e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>SimpleToken dApp</h2>

      <button onClick={connect} className="btn">
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

      {account && (
        <div style={{ marginTop: 20, padding: 12, border: "1px solid #2a2a2a", borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Send STK</h3>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              className="input"
              placeholder="Recipient address (0x...)"
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
            />
            <input
              className="input"
              placeholder="Amount (e.g. 1.5)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button onClick={send} disabled={sending} className="btn">
              {sending ? "Sending..." : "Send STK"}
            </button>
          </div>
          {txHash && (
            <div style={{ marginTop: 10 }}>
              <b>Tx:</b>{" "}
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
                {txHash.slice(0,10)}…
              </a>
            </div>
          )}
        </div>
      )}

      {msg && (
        <div style={{ marginTop: 16, padding: 10, background: "#3b2f1b", border: "1px solid #6d5a2d", borderRadius: 8 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
