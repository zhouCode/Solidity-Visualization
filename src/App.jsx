import React, { useState, useEffect, useRef } from 'react';
import { Database, Globe, Code, Server, Terminal, CheckCircle, Loader, Cpu, FileJson, Layers, BookOpen, Activity, Key, Hash, Box, ScrollText, Radio, ChevronRight, Send } from 'lucide-react';

// 详细数据配置
const STEP_DETAILS = {
  1: {
    title: "Step 1: 交易构建 (Transaction Construction)",
    desc: "Web3.js 库将函数调用转换为以太坊虚拟机 (EVM) 可理解的数据。",
    tabs: [
      {
        label: "原理 (Concept)",
        icon: <BookOpen className="w-4 h-4" />,
        content: "前端不直接发送 'x=100'。它使用 ABI (应用二进制接口) 将函数签名 `set(uint256)` 和参数 `100` 编码为一个十六进制字符串。这个过程称为 'ABI Encoding'。"
      },
      {
        label: "数据包 (Payload)",
        icon: <FileJson className="w-4 h-4" />,
        content: (val) => `// Transaction Object
{
  "to": "0x71C...9A2", // 合约地址
  "data": "0x60fe47b1...${val.toString(16).padStart(64, '0')}", // MethodID + Param
  "value": "0x0",      // 不发送 ETH
  "gas": 21000         // Gas 限制
}`
      },
      {
        label: "Web3 代码",
        icon: <Code className="w-4 h-4" />,
        content: `// 1. 获取合约实例
const myContract = new web3.eth.Contract(abi, address);

// 2. 编码调用数据 (Off-chain)
const data = myContract.methods.set(val).encodeABI();

// 3. 准备发送
// 此时尚未签名，仅存在于前端内存中`
      }
    ]
  },
  2: {
    title: "Step 2: 签名与广播 (Signing & Broadcasting)",
    desc: "用户使用私钥对交易进行签名，并将其发送到 RPC 节点。",
    tabs: [
      {
        label: "原理 (Concept)",
        icon: <Key className="w-4 h-4" />,
        content: "为了防止伪造，必须使用私钥对交易哈希进行 ECDSA 签名。签名后的交易包含 (v, r, s) 值，证明了发送者的身份。随后，通过 `eth_sendRawTransaction` RPC 方法将这一串二进制数据推送到节点。"
      },
      {
        label: "RPC 请求",
        icon: <Server className="w-4 h-4" />,
        content: `// POST https://mainnet.infura.io/v3/...
{
  "jsonrpc": "2.0",
  "method": "eth_sendRawTransaction",
  "params": [
    "0xf86b8085... (RLP 编码的签名交易)"
  ],
  "id": 1
}`
      },
      {
        label: "Mempool",
        icon: <Layers className="w-4 h-4" />,
        content: `// 节点内部处理流程
1. 验证签名 (ecrecover)
2. 检查 Nonce 防止重放
3. 检查 Gas 费余额
4. 加入交易池 (Mempool) 等待打包`
      }
    ]
  },
  4: {
    title: "Step 3: EVM 执行 (EVM Execution)",
    desc: "矿工/验证者执行操作码，修改世界状态树 (World State Trie)。",
    tabs: [
      {
        label: "原理 (Concept)",
        icon: <Cpu className="w-4 h-4" />,
        content: "EVM 读取交易中的 `data`。前4个字节匹配函数选择器。随后的 32 字节被加载为参数。执行 SSTORE 指令将数值写入合约在区块链上的特定存储槽 (Slot)。"
      },
      {
        label: "存储 (Storage)",
        icon: <Database className="w-4 h-4" />,
        content: (val) => `// Contract Storage Layout
Slot[0]: ${val} (0x${val.toString(16)})

// 状态是永久性的，每个全节点都会同步此修改`
      },
      {
        label: "Solidity",
        icon: <Code className="w-4 h-4" />,
        content: `function set(uint x) public {
    // 修改状态变量
    storedData = x; 
}`
      }
    ]
  },
  5: {
    title: "Step 4: 事件日志与回执 (Events & Logs)",
    desc: "合约触发 emit 事件，日志被写入区块头布隆过滤器，前端监听到变化。",
    tabs: [
      {
        label: "Solidity 事件",
        icon: <ScrollText className="w-4 h-4" />,
        content: `// 1. 定义事件
event DataChanged(uint256 newValue);

function set(uint x) public {
    storedData = x;
    
    // 2. 触发事件 (比存储更省 Gas)
    emit DataChanged(x);
}`
      },
      {
        label: "底层日志结构",
        icon: <Hash className="w-4 h-4" />,
        content: (val) => `// Transaction Receipt -> Logs
{
  "topics": [
    // sha3("DataChanged(uint256)")
    "0x59a3d5b...event_signature_hash" 
  ],
  "data": "0x000...${val.toString(16)}", // 非 indexed 参数
  "address": "0xContractAddress"
}`
      },
      {
        label: "前端监听",
        icon: <Radio className="w-4 h-4" />,
        content: `// Web3.js / Ethers.js
contract.events.DataChanged()
  .on('data', (event) => {
     console.log("新值:", event.returnValues.newValue);
     // 在这里更新 UI，而不是等待交易返回
     updateUI();
  });`
      }
    ]
  }
};

const App = () => {
  const [currentStep, setCurrentStep] = useState(0); 
  const [detailStep, setDetailStep] = useState(1); 
  const [activeTab, setActiveTab] = useState(0);   
  const [inputValue, setInputValue] = useState(100);
  const [chainValue, setChainValue] = useState(0);
  const [logs, setLogs] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // 使用 ref 自动滚动日志
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // 自动切换详情页
  useEffect(() => {
    if (currentStep === 1) { setDetailStep(1); setActiveTab(0); }
    if (currentStep === 3) { setDetailStep(2); setActiveTab(1); } 
    if (currentStep === 4) { setDetailStep(4); setActiveTab(0); }
    if (currentStep === 5) { setDetailStep(5); setActiveTab(2); } 
  }, [currentStep]);

  const runSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setLogs([]);
    setCurrentStep(1);

    addLog("1. [Frontend] Web3.js 初始化，准备构建交易...", "info");

    // Step 1: Frontend (2s)
    setTimeout(() => {
      setCurrentStep(2);
      addLog("2. [Wallet] 用户使用 MetaMask 签名...", "warning");
    }, 2500);

    // Step 2: Node (5s)
    setTimeout(() => {
      setCurrentStep(3);
      addLog("3. [Network] 签名交易广播至 RPC 节点...", "purple");
    }, 5000);

    // Step 3: EVM (8s)
    setTimeout(() => {
      setCurrentStep(4);
      addLog("4. [Blockchain] EVM 执行 SSTORE 更新状态...", "success");
    }, 8000);

    // Step 4: Events (10s)
    setTimeout(() => {
      setChainValue(inputValue);
      setCurrentStep(5);
      addLog(`5. [Event] 合约触发 emit DataChanged(${inputValue})`, "event");
    }, 10500);

    // Step 5: Finalized (13s)
    setTimeout(() => {
      addLog(`6. [Client] 前端监听到事件，UI 更新完成。`, "info");
      setIsSimulating(false);
    }, 13500);
    
    setTimeout(() => {
      if(currentStep === 5) setCurrentStep(0);
    }, 18000);
  };

  const addLog = (msg, type) => {
    setLogs(prev => [...prev, { msg, type, id: Date.now() }]);
  };

  const getStepStyle = (stepTrigger, activeColor) => {
    const isActive = currentStep === stepTrigger || (currentStep > stepTrigger && currentStep < stepTrigger + 2);
    const isSelected = (detailStep === stepTrigger) || (stepTrigger === 3 && detailStep === 2) || (stepTrigger === 4 && detailStep === 5);
    
    let baseStyle = "relative p-6 rounded-xl border-2 transition-all duration-500 flex flex-col gap-4 cursor-pointer hover:shadow-md z-10 ";
    
    if (isActive) {
      return baseStyle + `border-${activeColor}-500 ring-4 ring-${activeColor}-100 shadow-xl bg-white scale-[1.02]`;
    } else if (isSelected && !isSimulating) {
      return baseStyle + `border-${activeColor}-300 bg-slate-50 ring-2 ring-${activeColor}-50`;
    }
    return baseStyle + "border-gray-200 bg-gray-50 opacity-70 hover:opacity-100 grayscale hover:grayscale-0";
  };

  const handleCardClick = (step) => {
    if (!isSimulating) {
      setDetailStep(step);
      setActiveTab(0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="text-blue-600" />
              智能合约交互可视化
            </h1>
            <p className="text-slate-500 text-sm mt-1">Web3 Frontend ↔ Events ↔ Blockchain State</p>
          </div>
          
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Input</span>
              <input 
                type="number" 
                value={inputValue}
                onChange={(e) => setInputValue(parseInt(e.target.value) || 0)}
                className="bg-transparent w-16 font-mono font-bold text-lg text-slate-700 focus:outline-none text-right"
                disabled={isSimulating}
              />
            </div>
            <button 
              onClick={runSimulation}
              disabled={isSimulating}
              className={`px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all shadow-sm ${
                isSimulating 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md transform hover:-translate-y-0.5'
              }`}
            >
              {isSimulating ? <Loader className="animate-spin w-4 h-4" /> : <Terminal className="w-4 h-4" />}
              {isSimulating ? 'Simulating...' : 'Execute Transaction'}
            </button>
          </div>
        </div>

        {/* Main Visualization Flow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative py-4">
          
          {/* Animated Connection 1: Frontend -> Node */}
          <div className="hidden md:flex absolute top-1/2 left-[28%] w-[14%] -translate-y-1/2 z-0 items-center justify-center">
            <div className="w-full h-0.5 bg-slate-200 relative rounded-full overflow-visible">
               <div className="absolute inset-0 border-t-2 border-slate-300 border-dashed w-full"></div>
               <div 
                  className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-100 border-2 border-blue-500 rounded-full flex items-center justify-center shadow-sm z-10 transition-all duration-[2500ms] ease-in-out ${
                    currentStep >= 2 ? 'left-[100%] opacity-100' : 'left-0 opacity-0'
                  }`}
                >
                  <Key className="w-3 h-3 text-blue-600" />
               </div>
               <ChevronRight className={`absolute -right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 ${currentStep >= 2 ? 'text-blue-400' : ''}`} />
            </div>
          </div>

          {/* Animated Connection 2: Node -> Chain */}
          <div className="hidden md:flex absolute top-1/2 right-[28%] w-[14%] -translate-y-1/2 z-0 items-center justify-center">
            <div className="w-full h-0.5 bg-slate-200 relative rounded-full overflow-visible">
               <div className="absolute inset-0 border-t-2 border-slate-300 border-dashed w-full"></div>
               <div 
                  className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-purple-100 border-2 border-purple-500 rounded-full flex items-center justify-center shadow-sm z-10 transition-all duration-[3000ms] ease-in-out ${
                    currentStep >= 3 ? 'left-[100%] opacity-100' : 'left-0 opacity-0'
                  }`}
                >
                  <Send className="w-3 h-3 text-purple-600" />
               </div>
               <ChevronRight className={`absolute -right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 ${currentStep >= 3 ? 'text-purple-400' : ''}`} />
            </div>
          </div>

          {/* Log Return Animation (Chain -> Frontend) */}
          {currentStep === 5 && (
             <div className="hidden md:flex absolute top-[20%] left-0 right-0 justify-center items-center z-20 animate-bounce">
                <div className="bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 animate-fade-in-up">
                   <Radio className="w-3 h-3 animate-pulse" />
                   Event Emitted: DataChanged({inputValue})
                </div>
             </div>
          )}

          {/* Card 1: Frontend */}
          <div className={getStepStyle(1, 'blue')} onClick={() => handleCardClick(1)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold">Frontend</h2>
              </div>
              {currentStep === 5 && <span className="flex items-center gap-1 text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3"/> Received</span>}
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-500 font-mono bg-slate-100 p-2 rounded">
                web3.eth.Contract(abi)...
              </div>
              <div className={`text-xs font-medium flex items-center gap-1 ${currentStep === 2 ? 'text-orange-600' : 'text-slate-400'}`}>
                <Key className="w-3 h-3" />
                {currentStep === 2 ? 'Metamask Signing...' : 'Waiting for Sign'}
              </div>
            </div>
          </div>

          {/* Card 2: Node */}
          <div className={getStepStyle(3, 'purple')} onClick={() => handleCardClick(2)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-600" />
                <h2 className="font-bold">Node (RPC)</h2>
              </div>
              {currentStep === 3 && <span className="animate-ping h-2 w-2 rounded-full bg-purple-500"></span>}
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-500 font-mono bg-slate-100 p-2 rounded truncate">
                POST eth_sendRawTransaction
              </div>
              <div className={`text-xs font-medium flex items-center gap-1 ${currentStep === 3 ? 'text-purple-600' : 'text-slate-400'}`}>
                <Layers className="w-3 h-3" />
                {currentStep === 3 ? 'Broadcasting to Peers...' : 'Idle'}
              </div>
            </div>
          </div>

          {/* Card 3: Chain */}
          <div className={getStepStyle(4, 'green')} onClick={() => handleCardClick(4)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                <h2 className="font-bold">Blockchain</h2>
              </div>
              {currentStep === 4 && <span className="animate-ping h-2 w-2 rounded-full bg-green-500"></span>}
            </div>
             <div className="space-y-2">
              <div className="text-xs text-slate-500 font-mono bg-slate-100 p-2 rounded">
                EVM Opcode: SSTORE & LOG1
              </div>
              <div className={`flex items-center justify-between p-2 rounded bg-green-50 border border-green-100 transition-colors ${currentStep === 5 ? 'bg-green-100 ring-2 ring-green-400' : ''}`}>
                <span className="text-xs font-bold text-green-700 uppercase">State</span>
                <span className="text-lg font-bold text-green-800 font-mono">{chainValue}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detail Sub-Page / Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96 transition-all duration-500">
          
          {/* Left: Detail View (The "Sub-page") */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in">
            
            {/* 1. Tab Header (固定 - 修复了 flex 布局，横向排列) */}
            <div className="flex-none border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm overflow-x-auto flex items-center">
              {STEP_DETAILS[detailStep] && STEP_DETAILS[detailStep].tabs.map((tab, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                    activeTab === idx 
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50' 
                    : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 2. Title & Desc (固定 - 减小了 padding 以节省垂直空间) */}
            {STEP_DETAILS[detailStep] && (
                <div className="flex-none px-6 py-3 border-b border-slate-100 bg-white z-10 relative shadow-sm">
                    <div className="absolute top-3 right-6 text-slate-100 pointer-events-none">
                         {detailStep === 1 && <Globe className="w-12 h-12" />}
                         {detailStep === 2 && <Server className="w-12 h-12" />}
                         {detailStep === 4 && <Cpu className="w-12 h-12" />}
                         {detailStep === 5 && <ScrollText className="w-12 h-12" />}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2 relative z-20">
                        {STEP_DETAILS[detailStep].title}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-xl leading-relaxed relative z-20 line-clamp-2">
                        {STEP_DETAILS[detailStep].desc}
                    </p>
                </div>
             )}

            {/* 3. Content Area (独立滚动 - 获得了更多空间) */}
            <div className="flex-1 p-4 relative overflow-y-auto bg-slate-50/30">
              {STEP_DETAILS[detailStep] ? (
                <div className="animate-fade-in h-full">
                  
                  {/* Code Window UI */}
                  <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden flex flex-col min-h-[200px]">
                    {/* Mac-style Header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Read-only</span>
                    </div>
                    
                    {/* Code Content */}
                    <div className="p-4 overflow-x-auto custom-scrollbar flex-1">
                         <pre className="text-sm font-mono text-blue-300 leading-relaxed">
                          {typeof STEP_DETAILS[detailStep].tabs[activeTab].content === 'function' 
                            ? STEP_DETAILS[detailStep].tabs[activeTab].content(inputValue)
                            : STEP_DETAILS[detailStep].tabs[activeTab].content
                          }
                        </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <p>Select a stage to view details</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Logs */}
          <div className="lg:col-span-1 bg-slate-900 rounded-2xl p-4 text-xs font-mono text-slate-300 overflow-hidden shadow-lg border border-slate-700 flex flex-col h-full">
             <div className="flex-none bg-slate-900 pb-2 border-b border-slate-700 mb-2 flex items-center gap-2 text-slate-100 font-bold z-10">
               <Terminal className="w-4 h-4" />
               <span>System Logs</span>
             </div>
             <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
               {logs.length === 0 && <span className="text-slate-600 italic block mt-4 text-center">Ready to start simulation...</span>}
               {logs.map((log) => (
                 <div key={log.id} className="animate-fade-in-left">
                   <span className="text-slate-500 mr-2">[{new Date(log.id).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                   <span className={`${
                     log.type === 'info' ? 'text-blue-400' : 
                     log.type === 'warning' ? 'text-orange-400' : 
                     log.type === 'purple' ? 'text-purple-400' : 
                     log.type === 'event' ? 'text-yellow-400 font-bold' :
                     log.type === 'success' ? 'text-green-400' : 'text-gray-300'
                   }`}>
                     {log.msg}
                   </span>
                 </div>
               ))}
               <div ref={logsEndRef} />
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;