// Fixture: BRIMAPAY Vancouver, opening 26-Oct-2026, sample transactions TX-001..TX-005 on 27-Oct-2026.
module.exports=function(opts){opts=opts||{};const P='2026-10-26',D='2026-10-27';
 const r2=v=>Math.round(v*100)/100;
 const usdAvg=(2720+1350)/3000, usdCost=r2(400*usdAvg);
 const J=[];let id=0;const j=(o)=>J.push({id:++id,cust:'',by:o.by||'Farhan',at:o.at||(o.date+'T16:00:00.000Z'),...o});
 j({date:P,br:'b1',acc:'cash|b1',tt:'Opening',memo:'Opening till',lines:[['1000',1514,0],['3000',0,1514]]});
 j({date:P,br:'b1',acc:'sub|1005',tt:'Opening',memo:'Opening safe',lines:[['1005',10000,0],['3000',0,10000]]});
 j({date:P,br:'b1',acc:'bank|k1',bank:'k1',tt:'Opening',memo:'Opening bank',lines:[['1010',18250,0],['3000',0,18250]]});
 j({date:P,br:'b1',tt:'Opening',memo:'Opening currency stock USD 2,000 AED 5,000 ETB 120,000 KES 250,000',lines:[['1100',2720+1860+1152+2625,0],['3000',0,2720+1860+1152+2625]]});
 j({date:P,br:'b1',tt:'Opening',memo:'Opening due from Taaj',lines:[['1250',3200,0],['3000',0,3200]]});
 j({date:P,br:'b1',tt:'Opening',memo:'Retained earnings brought forward',lines:[['3000',1321,0],['3900',0,1321]]});
 if(!opts.noTx){
  j({date:D,br:'b1',acc:'cash|b1',tt:'Forex',vno:'TX-001',at:D+'T16:12:41.000Z',memo:'TX-001 Bought 1,000 USD @ 1.3500 from walk-in customer (KYC-55812)',lines:[['1100',1350,0],['1000',0,1350]]});
  j({date:D,br:'b1',acc:'cash|b1',tt:'Withdrawal',vno:'TX-002',at:D+'T17:05:19.000Z',party:'Taaj System',memo:'TX-002 Taaj inbound remittance TJ-88231 paid to beneficiary; commission due from Taaj',lines:[['1250',835,0],['1000',0,800],['4100',0,35]]});
  j({date:D,br:'b1',acc:'cash|b1',tt:'Deposit',vno:'TX-003',at:D+'T18:40:02.000Z',party:'Taaj System',memo:'TX-003 Taaj settlement TJ-SET-1027 received in cash',lines:[['1000',1500,0],['1250',0,1500]]});
  j({date:D,br:'b1',acc:'cash|b1',tt:'Forex',vno:'TX-004',at:D+'T20:18:30.000Z',memo:'TX-004 Sold 400 USD @ 1.3950 to walk-in customer (KYC-55840)',lines:[['1000',558,0],['1100',0,usdCost],['4200',0,r2(558-usdCost)]]});
  j({date:D,br:'b1',acc:'cash|b1',tt:'Expense',vno:'TX-005',at:D+'T22:46:10.000Z',memo:'TX-005 Office supplies, receipt RCPT-7781',lines:[['6100',22,0],['1000',0,22]]});
 }
 const usdQ=opts.noTx?2000:2600,usdC=opts.noTx?1.36:(2720+1350-usdCost)/2600;
 return{base:'CAD',me:0,co:{name:'BRIMAPAY Financial Services Inc.'},
  br:[{id:'b1',name:'Vancouver'},{id:'b2',name:'Surrey'}],
  users:[{name:'ZAHID',role:'Owner',br:'All'},{name:'Farhan',role:'Cashier',br:'b1'},{name:'Amina',role:'Manager',br:'All'},{name:'Daniel',role:'Accountant',br:'All'},{name:'Sara',role:'Viewer',br:'All'}],
  cust:[{id:'c1',name:'Walk-in / Cash',type:'Customer',status:'Active'}],
  rates:{USD:{b:1.36,s:1.40},AED:{b:0.37,s:0.38},ETB:{b:0.0096,s:0.0100},KES:{b:0.0102,s:0.0106}},
  banks:[{id:'k1',name:'RBC Operating',no:'0012',ccy:'CAD',br:'b1'}],
  coa:{1005:'Safe – CAD',1050:'Bank Transfers Clearing',1250:'Due from Taaj System',2150:'Customer Deposits',3900:'Retained Earnings',4100:'Remittance Commission Income',6100:'Office Supplies',6700:'Bank Charges'},
  par:{1005:'1000'},acx:{1005:{grp:'Cash & Bank',cur:'base'}},
  pos:{'b1|USD':{q:usdQ,c:usdC},'b1|AED':{q:5000,c:0.372},'b1|ETB':{q:120000,c:0.0096},'b1|KES':{q:250000,c:0.0105}},
  items:[],ist:{},inv:[],fx:[],docs:[],j:J};
};
