"use client";

type AppearanceMode="light"|"dark"|"system";
type AppearancePalette="oasis"|"lilac"|"midnight"|"sand";

type Props={
  mode:AppearanceMode;
  palette:AppearancePalette;
  onModeChange:(mode:AppearanceMode)=>void;
  onPaletteChange:(palette:AppearancePalette)=>void;
};

const modes:{id:AppearanceMode;icon:string;title:string;description:string}[]=[
  {id:"light",icon:"☀",title:"فاتح",description:"إضاءة واضحة وهادئة"},
  {id:"dark",icon:"☾",title:"ليلي",description:"راحة أكثر للعين"},
  {id:"system",icon:"◐",title:"حسب الجهاز",description:"يتبع إعداد جهازك"},
];

const palettes:{id:AppearancePalette;title:string;description:string;swatches:string[]}[]=[
  {id:"oasis",title:"واحة NAVIXA",description:"فيروزي وخزامى",swatches:["#14b8aa","#8a6de0","#f8f5ef"]},
  {id:"lilac",title:"خزامى هادئ",description:"بنفسجي ووردي ناعم",swatches:["#8f70df","#d181bc","#fff7fb"]},
  {id:"midnight",title:"ليل هادئ",description:"نيلي وسماوي",swatches:["#2865ba","#39c8da","#f4f8ff"]},
  {id:"sand",title:"رمال دافئة",description:"أخضر صحراوي وذهبي",swatches:["#2c8877","#c59046","#fff9ee"]},
];

export default function AppearanceSettings({mode,palette,onModeChange,onPaletteChange}:Props){
  return <section className="appearance-settings" aria-label="إعدادات مظهر NAVIXA">
    <div className="appearance-heading"><div><small>المظهر</small><h3>شكّل NAVIXA بطريقتك</h3><p>تُحفظ هذه الخيارات على جهازك فقط.</p></div><span aria-hidden="true">✦</span></div>
    <div className="appearance-section"><b>وضع الواجهة</b><div className="appearance-mode-grid">{modes.map(item=><button type="button" key={item.id} className={mode===item.id?"selected":""} onClick={()=>onModeChange(item.id)} aria-pressed={mode===item.id}><span>{item.icon}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}</div></div>
    <div className="appearance-section"><b>لوحة الألوان</b><div className="appearance-palette-grid">{palettes.map(item=><button type="button" key={item.id} className={palette===item.id?"selected":""} onClick={()=>onPaletteChange(item.id)} aria-pressed={palette===item.id}><i>{item.swatches.map(color=><em key={color} style={{background:color}}/>)}</i><strong>{item.title}</strong><small>{item.description}</small></button>)}</div></div>
    <p className="appearance-note">يمكنك التبديل في أي وقت؛ لا يتم إرسال تفضيلات المظهر إلى الخادم.</p>
  </section>;
}
