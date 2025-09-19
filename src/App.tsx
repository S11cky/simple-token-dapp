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

      // vyber MetaMask provider (Brave/viac walletiek)
      const anyWin = window as any;
      let eth = anyWin.ethereum;
      if (eth?.providers?.length) {
        eth = eth.providers.find((p: any) => p.isMetaMask) ?? eth.providers[0];
      }
      if (!eth?.request) {
        setMsg("MetaMask provider nebol nájdený (skontroluj rozšírenie).");
        return;
      }

      // prístup k účtom
      await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts?.length) { setMsg("Žiadny odomknutý účet v MetaMask."); return; }
      setAccount(accounts[0]);

      // prepni na Sepolia
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xAA36A7" }] });
      } catch (e: any) {
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
        } else {
          throw e;
        }
      }

      // provider + kontrakt
      const provider = new ethers.BrowserProvider(eth);
      const signer = await provider.getSigner();
      const token = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      const [n, s, d] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
      setTokenName(n); setTokenSymbol(s); setDecimals(Number(d));

      const bal = await token.balanceOf(accounts[0]);
      setBalance(ethers.formatUnits(bal, Number(d)));
      setMsg("");
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function send() {
    try {
      setMsg(""); setTxHash("");
      if (!account) { setMsg("Najprv sa pripoj peňaženkou."); return; }
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
    } catch (e: any) {
      if (e?.code === 4001) setMsg("Transakcia odmietnutá v MetaMask.");
      else setMsg(e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", fontFamily: "Inter, system-ui, Arial" }}>
      <h2>SimpleToken dApp</h2>

      {!account && (
        <button onClick={connect} style={{ padding: "10px 14px", borderRadius: 10 }}>
          Connect Wallet
        </button>
      )}

      {account && (
        <div style={{ marginTop: 16 }}>
          <div><b>Account:</b> {short(account)}</div>
          <div><b>Token:</b> {tokenName} ({tokenSymbol})</div>
          <div><b>Balance:</b> {balance || "0"} {tokenSymbol}</div>
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
            <button onClick={send} disabled={sending} style={{ padding: "10px 14px", borderRadius: 10 }}>
              {sending ? "Sending..." : "Send STK"}
            </button>
          </div>
          {txHash && (
            <div style={{ marginTop: 10 }}>
              <b>Tx:</b> <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">{short(txHash)}</a>
            </div>
          )}
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
