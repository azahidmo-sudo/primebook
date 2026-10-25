// Test fixture: BRIMAPAY-like ledger in CAD
module.exports=function(){const d='2026-10-24',y='2026-10-23';return{
 base:'CAD',me:0,
 co:{name:'BRIMAPAY Financial Services Inc.'},
 br:[{id:'b1',name:'VANCOUVER'},{id:'b2',name:'SURREY'}],
 users:[{name:'ZAHID',role:'Owner',br:'All'},{name:'Mia',role:'Manager',br:'All'},{name:'Carl',role:'Cashier',br:'b1'},{name:'Ana',role:'Accountant',br:'All'},{name:'Vic',role:'Viewer',br:'All'}],
 cust:[{id:'c1',name:'Walk-in / Cash',type:'Customer',status:'Active'},{id:'c2',name:'Northwind Ltd',type:'Customer',status:'Active'},{id:'s1',name:'BC Hydro',type:'Supplier',status:'Active'}],
 rates:{USD:{b:1.36,s:1.40},EUR:{b:1.48,s:1.52}},
 banks:[{id:'k1',name:'RBC Operating',no:'0012',ccy:'CAD',br:'b1'},{id:'k2',name:'RBC USD',no:'0099',ccy:'USD',br:'b1'},{id:'k3',name:'TD Old Account',no:'0450',ccy:'CAD',br:'b2',status:'Inactive'}],
 coa:{1050:'Bank Transfers Clearing',2150:'Customer Deposits',2500:'Loans Payable',4400:'Interest Income',4500:'Commission Income',6700:'Bank Charges',6600:'Office Supplies'},
 pos:{},items:[],ist:{},inv:[],fx:[],docs:[],
 j:[{id:1,date:y,br:'b1',memo:'Opening capital',tt:'Opening',lines:[['1000',5000,0],['3000',0,5000]]},
    {id:2,date:y,br:'b1',acc:'bank|k1',bank:'k1',memo:'Opening bank',tt:'Opening',lines:[['1010',20000,0],['3000',0,20000]]},
    {id:3,date:y,br:'b1',acc:'bank|k2',bank:'k2',ccy:'USD',rate:1.35,fa:1000,memo:'Opening USD',tt:'Opening',lines:[['1010',1350,0],['3000',0,1350]]}]
}};
