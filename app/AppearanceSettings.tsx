"use client";

type AppearanceMode="light"|"dark"|"system";
type AppearancePalette="oasis"|"lilac"|"midnight"|"sand";
type TextScale="default"|"large"|"xlarge";

type Props={
  mode:AppearanceMode;
  palette:AppearancePalette;
  textScale:TextScale;
  highContrast:boolean;
  onModeChange:(mode:AppearanceMode)=>void;
  onPaletteChange:(palette:AppearancePalette)=>void;
  onTextScaleChange:(scale:TextScale)=>void;
  onHighContrastChange:(enabled:boolean)=>void;
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

const scales:{id:TextScale;title:string;description:string}[]=[
  {id:"default",title:"عادي",description:"الحجم الافتراضي"},
  {id:"large",title:"كبير",description:"أسهل للقراءة"},
  {id:"xlarge",title:"كبير جدًا",description:"وضوح أعلى"},
];

export default function AppearanceSettings({mode,palette,textScale,highContrast,onModeChange,onPaletteChange,onTextScaleChange,onHighContrastChange}:Props){
  return <section className="appearance-settings" aria-label="إعدادات مظهر ووصول NAVIXA">
    <div className="appearance-heading"><div><small>المظهر والوصول</small><h3>شكّل NAVIXA بطريقتك</h3><p>تُحفظ هذه الخيارات على جهازك فقط.</p></div><span aria-hidden="true">✦</span></div>
    <div className="appearance-section"><b>وضع الواجهة</b><div className="appearance-mode-grid">{modes.map(item=><button type="button" key={item.id} className={mode===item.id?"selected":""} onClick={()=>onModeChange(item.id)} aria-pressed={mode===item.id}><span>{item.icon}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}</div></div>
    <div className="appearance-section"><b>لوحة الألوان</b><div className="appearance-palette-grid">{palettes.map(item=><button type="button" key={item.id} className={palette===item.id?"selected":""} onClick={()=>onPaletteChange(item.id)} aria-pressed={palette===item.id}><i>{item.swatches.map(color=><em key={color} style={{background:color}}/>)}</i><strong>{item.title}</strong><small>{item.description}</small></button>)}</div></div>
    <div className="appearance-section accessibility-section"><b>وضوح القراءة</b><div className="appearance-scale-grid">{scales.map(item=><button type="button" key={item.id} className={textScale===item.id?"selected":""} onClick={()=>onTextScaleChange(item.id)} aria-pressed={textScale===item.id}><strong>{item.title}</strong><small>{item.description}</small></button>)}</div><label className="appearance-contrast-toggle"><span><b>تباين أوضح</b><small>يرفع وضوح النصوص والحدود</small></span><input type="checkbox" checked={highContrast} onChange={event=>onHighContrastChange(event.target.checked)}/><i aria-hidden="true"/></label></div>
    <p className="appearance-note">تعمل أدوات الوضوح على هذا الجهاز فقط، ويمكن تغييرها في أي وقت.</p>
  </section>;
}
