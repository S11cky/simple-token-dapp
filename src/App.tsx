import { useState } from "react";
import { ethers } from "ethers";

/** Minimal ABI pre ERC-20 + EIP-2612 */
const abi = [
  // reads
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function nonces(address) view returns (uint256)",
  // writes
  "function transfer(address to,uint256 value) returns (bool)",
  "function approve(address spender,uint256 value) returns (bool)",
  "function transferFrom(address from,address to,uint256 value) returns (bool)",
  // EIP-2612
  "function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)"
];

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;

export default function App() {
  // basic info
  const [account, setAccount] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [decimals, setDecimals] = useState(18);
  const [balance, setBalance] = useState("");

  // send
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");

  // approve / permit / transferFrom
  const [spender, setSpender] = useState("");
  const [approveAmount, setApproveAmount] = useState("");
  const [allowanceView, setAllowanceView] = useState("0");
  const [pullFrom, setPullFrom] = useState("");
  const [pullAmount, setPullAmount] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function short(x: string) { return x ? x.slice(0, 6) + "…" + x.slice(-4) : ""; }

  /** získa MetaMask provider, uprednostní isMetaMask (kvôli Brave) */
  async function getEth() {
    const w: any = window;
    let eth = w.ethereum;
    if (eth?.providers?.length) eth = eth.providers.find((p: any) => p.isMetaMask) ?? eth.providers[0];
    if (!eth?.request) throw new Error("MetaMask provider nebol nájdený.");
    return eth;
  }
  async function getTokenWithSigner() {
    const eth = await getEth();
    const provider = new ethers.BrowserProvider(eth);
    const signer = await provider.getSigner();
    const token = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
    return { eth, provider, signer, token };
  }

  // ---------- CONNECT ----------
  async function connect() {
    try {
      setMsg(""); setTxHash("");
      const eth = await getEth();

      // účty
      await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      const accs: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!accs?.length) throw new Error("Žiadny odomknutý účet v MetaMask.");
      setAccount(accs[0]);

      // Sepolia
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
        } else { throw e; }
      }

      const { signer, token } = await getTokenWithSigner();
      const [n, s, d] = await Promise.all([token.name(), token.symbol(), token.decimals()]);
      setTokenName(n); setTokenSymbol(s); setDecimals(Number(d));

      const bal = await token.balanceOf(await signer.getAddress());
      setBalance(ethers.formatUnits(bal, Number(d)));
    } catch (e: any) { setMsg(e?.message ?? String(e)); }
  }

  // ---------- SEND ----------
  async function send() {
    try {
      setBusy(true); setMsg(""); setTxHash("");
      if (!ethers.isAddress(to)) throw new Error("Neplatná adresa príjemcu.");
      if (!amount || Number(amount) <= 0) throw new Error("Zadaj kladnú sumu.");

      const { signer, token } = await getTokenWithSigner();
      const d: number = await token.decimals();
      const value = ethers.parseUnits(amount.trim(), d);
      const tx = await token.transfer(to, value);
      setTxHash(tx.hash);
      await tx.wait();

      const bal = await token.balanceOf(await signer.getAddress());
      setBalance(ethers.formatUnits(bal, d));
      setMsg("Transakcia odoslaná a potvrdená.");
    } catch (e: any) { setMsg(e?.code === 4001 ? "Transakcia odmietnutá v MetaMask." : (e?.message ?? String(e))); }
    finally { setBusy(false); }
  }

  // ---------- APPROVE ----------
  async function doApprove() {
    try {
      setBusy(true); setMsg(""); setTxHash("");
      if (!ethers.isAddress(spender)) throw new Error("Neplatná adresa spendera.");
      if (!approveAmount || Number(approveAmount) <= 0) throw new Error("Zadaj kladnú sumu.");

      const { signer, token } = await getTokenWithSigner();
      const d: number = await token.decimals();
      const value = ethers.parseUnits(approveAmount.trim(), d);
      const tx = await token.approve(spender, value);
      setTxHash(tx.hash);
      await tx.wait();

      const alw = await token.allowance(await signer.getAddress(), spender);
      setAllowanceView(ethers.formatUnits(alw, d));
      setMsg("Approve hotový.");
    } catch (e: any) { setMsg(e?.code === 4001 ? "Operácia odmietnutá v MetaMask." : (e?.message ?? String(e))); }
    finally { setBusy(false); }
  }
  async function checkAllowance() {
    try {
      setBusy(true); setMsg("");
      if (!ethers.isAddress(spender)) throw new Error("Neplatná adresa spendera.");
      const { signer, token } = await getTokenWithSigner();
      const d: number = await token.decimals();
      const alw = await token.allowance(await signer.getAddress(), spender);
      setAllowanceView(ethers.formatUnits(alw, d));
    } catch (e: any) { setMsg(e?.message ?? String(e)); }
    finally { setBusy(false); }
  }

  // ---------- PERMIT (EIP-2612) ----------
  async function doPermit() {
    try {
      setBusy(true); setMsg(""); setTxHash("");
      if (!ethers.isAddress(spender)) throw new Error("Neplatná adresa spendera.");
      if (!approveAmount || Number(approveAmount) <= 0) throw new Error("Zadaj kladnú sumu.");

      const { provider, signer, token } = await getTokenWithSigner();
      const owner = await signer.getAddress();
      const d: number = await token.decimals();
      const value = ethers.parseUnits(approveAmount.trim(), d);
      const nonce = await token.nonces(owner);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      const name = await token.name();
      const domain = { name, version: "1", chainId, verifyingContract: CONTRACT_ADDRESS } as const;
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      } as const;
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 min

      const signature = await signer.signTypedData(domain, types as any, {
        owner, spender, value, nonce, deadline,
      });
      const sig = ethers.Signature.from(signature);

      const tx = await token.permit(owner, spender, value, deadline, sig.v, sig.r, sig.s);
      setTxHash(tx.hash);
      await tx.wait();

      const alw = await token.allowance(owner, spender);
      setAllowanceView(ethers.formatUnits(alw, d));
      setMsg("Permit hotový (gasless approve podpísaný, on-chain potvrdený).");
    } catch (e: any) { setMsg(e?.code === 4001 ? "Podpis/operácia odmietnutá v MetaMask." : (e?.message ?? String(e))); }
    finally { setBusy(false); }
  }

  // ---------- transferFrom (aktuálny účet = spender) ----------
  async function doTransferFrom() {
    try {
      setBusy(true); setMsg(""); setTxHash("");
      if (!ethers.isAddress(pullFrom)) throw new Error("Neplatná adresa ownera (pullFrom).");
      if (!pullAmount || Number(pullAmount) <= 0) throw new Error("Zadaj kladnú sumu.");

      const { signer, token } = await getTokenWithSigner();
      const d: number = await token.decimals();
      const value = ethers.parseUnits(pullAmount.trim(), d);

      const me = await signer.getAddress(); // príjemca = spender
      const tx = await token.transferFrom(pullFrom, me, value);
      setTxHash(tx.hash);
      await tx.wait();

      const bal = await token.balanceOf(me);
      setBalance(ethers.formatUnits(bal, d));
      setMsg("transferFrom hotový.");
    } catch (e: any) { setMsg(e?.code === 4001 ? "Operácia odmietnutá v MetaMask." : (e?.message ?? String(e))); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#111", color: "#eee", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 760, borderRadius: 16, padding: 24, border: "1px solid #2a2a2a", background: "#1b1b1b", boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>
        <h2 style={{ marginTop: 0 }}>SimpleToken dApp</h2>

        <button onClick={connect} style={{ padding: "10px 14px", borderRadius: 10 }}>
          {account ? "Connected ✅" : "Connect Wallet"}
        </button>

        {account && (
          <div style={{ marginTop: 16 }}>
            <div><b>Account:</b> {account}</div>
            <div><b>Network:</b> Sepolia (expected)</div>
            <div style={{ marginTop: 8 }}>
              <b>Token:</b> {tokenName} ({tokenSymbol})<br />
              <b>Balance:</b> {balance || "0"} {tokenSymbol}
            </div>
          </div>
        )}

        {/* SEND */}
        {account && (
          <section style={{ marginTop: 20, padding: 16, border: "1px solid #2a2a2a", borderRadius: 12 }}>
            <h3 style={{ marginTop: 0 }}>Send STK</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <input placeholder="Recipient address (0x...)" value={to} onChange={(e) => setTo(e.target.value.trim())}
                     style={{ padding: 8, borderRadius: 8, border: "1px solid #333", background: "#222", color: "#eee" }} />
              <input placeholder="Amount (e.g. 1.5)" value={amount} onChange={(e) => setAmount(e.target.value)}
                     style={{ padding: 8, borderRadius: 8, border: "1px solid #333", background: "#222", color: "#eee" }} />
              <button onClick={send} disabled={busy} style={{ padding: "10px 14px", borderRadius: 10 }}>{busy ? "Working..." : "Send STK"}</button>
            </div>
            {txHash && (
              <div style={{ marginTop: 10 }}>
                <b>Tx:</b>{" "}
                <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">{short(txHash)}</a>
              </div>
            )}
          </section>
        )}

        {/* APPROVE / PERMIT */}
        {account && (
          <section style={{ marginTop: 20, padding: 16, border: "1px solid #2a2a2a", borderRadius: 12 }}>
            <h3 style={{ marginTop: 0 }}>Approve / Permit</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <input placeholder="Spender (0x...)" value={spender} onChange={(e) => setSpender(e.target.value.trim())}
                     style={{ padding: 8, borderRadius: 8, border: "1px solid #333", background: "#222", color: "#eee" }} />
              <input placeholder="Amount to approve (e.g. 5)" value={approveAmount} onChange={(e) => setApproveAmount(e.target.value)}
                     style={{ padding: 8, borderRadius: 8, border: "1px solid #333", background: "#222", color: "#eee" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={doApprove} disabled={busy} style={{ padding: "10px 14px", borderRadius: 10 }}>{busy ? "Working..." : "Approve"}</button>
                <button onClick={doPermit} disabled={busy} style={{ padding: "10px 14px", borderRadius: 10 }}>{busy ? "Working..." : "Permit (EIP-2612)"}</button>
                <button onClick={checkAllowance} disabled={busy} style={{ padding: "10px 14px", borderRadius: 10 }}>{busy ? "Working..." : "Check Allowance"}</button>
              </div>
              <div><b>Allowance:</b> {allowanceView} {tokenSymbol}</div>
            </div>
          </section>
        )}

        {/* transferFrom = volá SPENDER */}
        {account && (
          <section style={{ marginTop: 20, padding: 16, border: "1px solid #2a2a2a", borderRadius: 12 }}>
            <h3 style={{ marginTop: 0 }}>transferFrom (as spender)</h3>
            <p style={{ marginTop: 0, opacity: .8 }}>
              Najprv sa pripoj ako <b>owner</b> a urob approve/permit pre <b>spendera</b>. Potom v MetaMask prepni účet na toho
              <b> spendera</b> a tu potiahni tokeny z ownera na seba.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <input placeholder="Pull from (owner address 0x...)" value={pullFrom} onChange={(e) => setPullFrom(e.target.value.trim())}
                     style={{ padding: 8, borderRadius: 8, border: "1px solid #333", background: "#222", color: "#eee" }} />
              <input placeholder="Amount to pull (e.g. 1.2)" value={pullAmount} onChange={(e) => setPullAmount(e.target.value)}
                     style={{ padding: 8, borderRadius: 8, border: "1px solid #333", background: "#222", color: "#eee" }} />
              <button onClick={doTransferFrom} disabled={busy} style={{ padding: "10px 14px", borderRadius: 10 }}>{busy ? "Working..." : "transferFrom"}</button>
            </div>
          </section>
        )}

        {msg && (
          <div style={{ marginTop: 16, padding: 10, background: "#3b2f1b", border: "1px solid #6d5a2d", borderRadius: 8 }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
