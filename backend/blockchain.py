
import hashlib
import json
import time
from dataclasses import dataclass, asdict
from typing import List, Any

def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

@dataclass
class Block:
    index: int
    timestamp: float
    prev_hash: str
    data: Any
    nonce: int
    hash: str

class MiniChain:
    """A tiny append-only blockchain for demo/education.
    - Each block's hash commits to (index, timestamp, prev_hash, data, nonce).
    - Proof-of-work is trivial (nonce so hash starts with '0000').
    - This is *not* production security—just a visual aid for anchoring.
    """
    def __init__(self):
        self.blocks: List[Block] = []
        self._add_genesis()

    def _add_genesis(self):
        genesis_data = {"message": "genesis"}
        block = self._mine_block(index=0, prev_hash="0"*64, data=genesis_data)
        self.blocks.append(block)

    def _mine_block(self, index: int, prev_hash: str, data: Any) -> Block:
        nonce = 0
        while True:
            payload = json.dumps({
                "index": index,
                "timestamp": None,  # excluded from PoW preimage to stabilize demos
                "prev_hash": prev_hash,
                "data": data,
                "nonce": nonce,
            }, separators=(",", ":"), sort_keys=True).encode()
            # bind real timestamp after PoW; include in final hash by re-hashing
            if sha256_hex(payload).startswith("0000"):
                ts = time.time()
                payload_with_ts = json.dumps({
                    "index": index,
                    "timestamp": ts,
                    "prev_hash": prev_hash,
                    "data": data,
                    "nonce": nonce,
                }, separators=(",", ":"), sort_keys=True).encode()
                final_hash = sha256_hex(payload_with_ts)
                return Block(index=index, timestamp=ts, prev_hash=prev_hash, data=data, nonce=nonce, hash=final_hash)
            nonce += 1

    def add_anchor(self, decision_hash: str, model_version: str = "v1") -> Block:
        assert isinstance(decision_hash, str) and len(decision_hash) > 0
        prev = self.blocks[-1]
        data = {"decision_hash": decision_hash, "model_version": model_version}
        block = self._mine_block(index=len(self.blocks), prev_hash=prev.hash, data=data)
        self.blocks.append(block)
        return block

    def to_dict(self) -> List[dict]:
        return [asdict(b) for b in self.blocks]

    def verify(self) -> bool:
        # verify chain linkage and PoW prefix
        for i, b in enumerate(self.blocks):
            if i == 0:
                if b.prev_hash != "0"*64:
                    return False
                continue
            if b.prev_hash != self.blocks[i-1].hash:
                return False
            # lightweight PoW check: hash starts with '0000'
            if not b.hash.startswith("0000"):
                return False
        return True
